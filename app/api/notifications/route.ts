import { NextResponse } from 'next/server';
import { appwrite } from '@/lib/appwrite';
import { auth } from '@clerk/nextjs';
import { Query, ID } from 'node-appwrite';

const DATABASE_ID = 'castdb';
const COLLECTION_ID = 'notifications';

export async function GET(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const response = await appwrite.databases.listDocuments(
      DATABASE_ID,
      COLLECTION_ID,
      [
        Query.equal('userId', userId),
        Query.orderDesc('createdAt'),
        Query.limit(50)
      ]
    );

    const notifications = response.documents.map((doc: any) => ({
      id: doc.$id,
      text: doc.text,
      read: doc.read,
      type: doc.type,
      createdAt: doc.createdAt
    }));

    return NextResponse.json({ notifications });
  } catch (error: any) {
    console.error('[Get Notifications Error]:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId: activeUserId } = auth();
    if (!activeUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { text, type } = await req.json();
    if (!text || !type) {
      return NextResponse.json({ error: 'Missing text or type' }, { status: 400 });
    }

    const newDoc = await appwrite.databases.createDocument(
      DATABASE_ID,
      COLLECTION_ID,
      ID.unique(),
      {
        userId: activeUserId,
        text,
        read: false,
        type,
        createdAt: new Date().toISOString()
      }
    );

    return NextResponse.json({ success: true, notification: newDoc });
  } catch (error: any) {
    console.error('[Create Notification Error]:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { userId: activeUserId } = auth();
    if (!activeUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ids, markAll } = await req.json();

    if (markAll) {
      // Fetch all unread notifications for active user to verify access
      const unread = await appwrite.databases.listDocuments(
        DATABASE_ID,
        COLLECTION_ID,
        [
          Query.equal('userId', activeUserId),
          Query.equal('read', false)
        ]
      );
      
      const updates = unread.documents.map(async (doc) => {
        return appwrite.databases.updateDocument(
          DATABASE_ID,
          COLLECTION_ID,
          doc.$id,
          { read: true }
        );
      });
      await Promise.all(updates);
      return NextResponse.json({ success: true, message: 'All notifications marked as read' });
    }

    if (!ids || !Array.isArray(ids)) {
      return NextResponse.json({ error: 'Invalid notification IDs' }, { status: 400 });
    }

    // Verify all target docs belong to activeUserId first before updating!
    const verificationAndUpdates = ids.map(async (id) => {
      const doc = await appwrite.databases.getDocument(DATABASE_ID, COLLECTION_ID, id);
      if (doc.userId !== activeUserId) {
        throw new Error(`Unauthorized update request for document ${id}`);
      }
      return appwrite.databases.updateDocument(DATABASE_ID, COLLECTION_ID, id, { read: true });
    });

    await Promise.all(verificationAndUpdates);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Update Notifications Error]:', error);
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
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Notification ID is required' }, { status: 400 });
    }

    // Security check: verify document belongs to activeUserId before deleting
    const doc = await appwrite.databases.getDocument(DATABASE_ID, COLLECTION_ID, id);
    if (doc.userId !== activeUserId) {
      return NextResponse.json({ error: 'Unauthorized: Notification belongs to a different user' }, { status: 403 });
    }

    await appwrite.databases.deleteDocument(DATABASE_ID, COLLECTION_ID, id);
    return NextResponse.json({ success: true, message: 'Notification deleted' });
  } catch (error: any) {
    console.error('[Delete Notification Error]:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
