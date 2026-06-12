import { NextResponse } from 'next/server';
import { appwrite } from '@/lib/appwrite';
import { auth } from '@clerk/nextjs';
import { Query, ID } from 'node-appwrite';
import { fetchOpenRouterCompletion } from '@/lib/openrouter';

const DATABASE_ID = 'castdb';
const CHATS_COLLECTION = 'chats';
const MESSAGES_COLLECTION = 'messages';

export async function GET(req: Request) {
  try {
    const { userId: activeUserId } = auth();
    if (!activeUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get('chatId');
    const searchVal = searchParams.get('query');

    // Case 1: Fetch messages inside a specific chat thread
    if (chatId) {
      // Security Check: Verify chat belongs to activeUserId
      const chat = await appwrite.databases.getDocument(DATABASE_ID, CHATS_COLLECTION, chatId);
      if (chat.userId !== activeUserId) {
        return NextResponse.json({ error: 'Unauthorized: Chat belongs to a different user' }, { status: 403 });
      }

      const messagesResponse = await appwrite.databases.listDocuments(
        DATABASE_ID,
        MESSAGES_COLLECTION,
        [
          Query.equal('chatId', chatId),
          Query.equal('userId', activeUserId),
          Query.orderAsc('createdAt'),
          Query.limit(100)
        ]
      );

      const messages = messagesResponse.documents.map((msg) => ({
        id: msg.$id,
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt
      }));

      return NextResponse.json({ messages });
    }

    // Case 2: List chat threads for the active user
    const chatsResponse = await appwrite.databases.listDocuments(
      DATABASE_ID,
      CHATS_COLLECTION,
      [
        Query.equal('userId', activeUserId),
        Query.equal('deleted', false),
        Query.orderDesc('updatedAt'),
        Query.limit(100)
      ]
    );

    let threads = chatsResponse.documents.map((doc) => ({
      id: doc.$id,
      title: doc.title,
      pinned: doc.pinned,
      deleted: doc.deleted,
      messageCount: doc.messageCount,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    }));

    // Local filtering for search queries
    if (searchVal) {
      const queryLower = searchVal.toLowerCase();
      threads = threads.filter(t => t.title.toLowerCase().includes(queryLower));
    }

    // Sort: Pinned first, then by updatedAt desc
    threads.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return NextResponse.json({ threads });
  } catch (error: any) {
    console.error('[Get Chat History Error]:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId: activeUserId } = auth();
    if (!activeUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { chatId, role, content } = await req.json();

    if (!role || !content) {
      return NextResponse.json({ error: 'Role and content are required' }, { status: 400 });
    }

    let targetChatId = chatId;
    const nowStr = new Date().toISOString();

    // Create a new chat if no chatId is provided or is set to 'new'
    if (!targetChatId || targetChatId === 'new') {
      targetChatId = ID.unique();
      await appwrite.databases.createDocument(
        DATABASE_ID,
        CHATS_COLLECTION,
        targetChatId,
        {
          userId: activeUserId,
          title: 'New Conversation',
          pinned: false,
          deleted: false,
          messageCount: 1,
          createdAt: nowStr,
          updatedAt: nowStr
        }
      );
    } else {
      // Security Check: Verify chat belongs to activeUserId
      const chat = await appwrite.databases.getDocument(DATABASE_ID, CHATS_COLLECTION, targetChatId);
      if (chat.userId !== activeUserId) {
        return NextResponse.json({ error: 'Unauthorized: Chat belongs to a different user' }, { status: 403 });
      }

      const nextMessageCount = (chat.messageCount || 0) + 1;
      const updates: any = {
        messageCount: nextMessageCount,
        updatedAt: nowStr
      };

      // Auto-generate title once when count becomes 2 (after user first msg and assistant first reply)
      if (nextMessageCount === 2) {
        try {
          // Fetch the first user message from the database
          const messagesResponse = await appwrite.databases.listDocuments(
            DATABASE_ID,
            MESSAGES_COLLECTION,
            [
              Query.equal('chatId', targetChatId),
              Query.orderAsc('createdAt'),
              Query.limit(5)
            ]
          );

          // Concatenate existing database message content with the current assistant message
          const textSummary = messagesResponse.documents
            .map((msg: any) => `${msg.role}: ${msg.content}`)
            .concat([`${role}: ${content}`])
            .join('\n');

          const generatedTitle = await fetchOpenRouterCompletion(
            [
              {
                role: 'system',
                content: 'You are a chat title generator. Generate an extremely short, concise title (maximum 3 to 5 words) summarizing the essence of the following conversation. Respond ONLY with the title. Do NOT use emojis, quotes, markdown, punctuation, or explanations.',
              },
              { role: 'user', content: textSummary },
            ],
            'google/gemini-2.5-flash:free'
          );

          const finalTitle = generatedTitle.trim().replace(/^["']|["']$/g, '');
          if (finalTitle && finalTitle.length > 0) {
            updates.title = finalTitle;
          }
        } catch (titleError) {
          console.error('[Auto-Title Generation Error]:', titleError);
        }
      }

      // Update chat messageCount and other updates (like auto-generated title)
      await appwrite.databases.updateDocument(
        DATABASE_ID,
        CHATS_COLLECTION,
        targetChatId,
        updates
      );
    }

    // Save message record
    const messageDoc = await appwrite.databases.createDocument(
      DATABASE_ID,
      MESSAGES_COLLECTION,
      ID.unique(),
      {
        chatId: targetChatId,
        userId: activeUserId,
        role,
        content,
        createdAt: nowStr
      }
    );

    return NextResponse.json({
      success: true,
      chatId: targetChatId,
      message: {
        id: messageDoc.$id,
        role: messageDoc.role,
        content: messageDoc.content,
        createdAt: messageDoc.createdAt
      }
    });
  } catch (error: any) {
    console.error('[Save Message Error]:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { userId: activeUserId } = auth();
    if (!activeUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { chatId, title, pinned, deleted } = await req.json();

    if (!chatId) {
      return NextResponse.json({ error: 'Chat ID is required' }, { status: 400 });
    }

    // Security Check: Verify chat belongs to activeUserId
    const chat = await appwrite.databases.getDocument(DATABASE_ID, CHATS_COLLECTION, chatId);
    if (chat.userId !== activeUserId) {
      return NextResponse.json({ error: 'Unauthorized: Chat belongs to a different user' }, { status: 403 });
    }

    const updates: any = {};
    if (title !== undefined) updates.title = title;
    if (pinned !== undefined) updates.pinned = pinned;
    if (deleted !== undefined) updates.deleted = deleted;
    updates.updatedAt = new Date().toISOString();

    const updatedChat = await appwrite.databases.updateDocument(
      DATABASE_ID,
      CHATS_COLLECTION,
      chatId,
      updates
    );

    return NextResponse.json({ success: true, chat: updatedChat });
  } catch (error: any) {
    console.error('[Update Chat Error]:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { userId: activeUserId } = auth();
    if (!activeUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get('chatId');

    if (!chatId) {
      return NextResponse.json({ error: 'Chat ID is required' }, { status: 400 });
    }

    // Security Check: Verify chat belongs to activeUserId
    const chat = await appwrite.databases.getDocument(DATABASE_ID, CHATS_COLLECTION, chatId);
    if (chat.userId !== activeUserId) {
      return NextResponse.json({ error: 'Unauthorized: Chat belongs to a different user' }, { status: 403 });
    }

    // 1. Find all associated messages in the messages collection
    const messagesResponse = await appwrite.databases.listDocuments(
      DATABASE_ID,
      MESSAGES_COLLECTION,
      [
        Query.equal('chatId', chatId),
        Query.limit(100)
      ]
    );

    // 2. Delete each associated message document
    for (const msg of messagesResponse.documents) {
      await appwrite.databases.deleteDocument(DATABASE_ID, MESSAGES_COLLECTION, msg.$id);
    }

    // 3. Hard delete chat thread document from chats collection
    await appwrite.databases.deleteDocument(
      DATABASE_ID,
      CHATS_COLLECTION,
      chatId
    );

    return NextResponse.json({ success: true, message: 'Chat thread and all associated messages hard deleted' });
  } catch (error: any) {
    console.error('[Delete Chat Error]:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
