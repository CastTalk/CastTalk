import { NextResponse } from 'next/server';
import { appwrite } from '@/lib/appwrite';
import { auth } from '@clerk/nextjs';
import { Query } from 'node-appwrite';

const DATABASE_ID = 'castdb';
const COLLECTION_ID = 'schedules';

export async function POST(req: Request) {
  try {
    const { userId: activeUserId } = auth();
    if (!activeUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { meetingId, title, description, startsAt, duration, meetingType } = await req.json();

    if (!meetingId || !title || !startsAt || !duration || !meetingType) {
      return NextResponse.json({ error: 'Missing required schedule attributes' }, { status: 400 });
    }

    // Save/update schedules document in Appwrite
    // We use the meetingId as the document ID for 1-to-1 correlation and safety against duplicates
    let document;
    try {
      // Check if document already exists
      const existing = await appwrite.databases.getDocument(DATABASE_ID, COLLECTION_ID, meetingId);
      
      // Security check: Verify owner matches activeUserId
      if (existing.createdBy !== activeUserId) {
        return NextResponse.json({ error: 'Unauthorized: Schedule belongs to a different user' }, { status: 403 });
      }

      document = await appwrite.databases.updateDocument(
        DATABASE_ID,
        COLLECTION_ID,
        meetingId,
        {
          title,
          description: description || '',
          startsAt,
          duration: Number(duration),
          meetingType
        }
      );
    } catch (err: any) {
      if (err.code === 404) {
        // Document does not exist, create it new
        document = await appwrite.databases.createDocument(
          DATABASE_ID,
          COLLECTION_ID,
          meetingId,
          {
            meetingId,
            title,
            description: description || '',
            startsAt,
            duration: Number(duration),
            meetingType,
            createdBy: activeUserId
          }
        );
      } else {
        throw err;
      }
    }

    return NextResponse.json({ success: true, schedule: document });
  } catch (error: any) {
    console.error('[Create Schedule API Error]:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { userId: activeUserId } = auth();
    if (!activeUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const response = await appwrite.databases.listDocuments(
      DATABASE_ID,
      COLLECTION_ID,
      [
        Query.equal('createdBy', activeUserId),
        Query.orderDesc('startsAt'),
        Query.limit(100)
      ]
    );

    const schedules = response.documents.map((doc: any) => ({
      id: doc.$id,
      meetingId: doc.meetingId,
      title: doc.title,
      description: doc.description,
      startsAt: doc.startsAt,
      duration: doc.duration,
      meetingType: doc.meetingType,
      createdBy: doc.createdBy
    }));

    return NextResponse.json({ schedules });
  } catch (error: any) {
    console.error('[Get Schedules API Error]:', error);
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
    const meetingId = searchParams.get('meetingId');

    if (!meetingId) {
      return NextResponse.json({ error: 'Meeting ID is required' }, { status: 400 });
    }

    // Security Check: Verify schedule belongs to activeUserId
    const existing = await appwrite.databases.getDocument(DATABASE_ID, COLLECTION_ID, meetingId);
    if (existing.createdBy !== activeUserId) {
      return NextResponse.json({ error: 'Unauthorized: Schedule belongs to a different user' }, { status: 403 });
    }

    // Hard delete schedule from Appwrite database
    await appwrite.databases.deleteDocument(DATABASE_ID, COLLECTION_ID, meetingId);

    return NextResponse.json({ success: true, message: 'Schedule hard deleted from database' });
  } catch (error: any) {
    console.error('[Delete Schedule API Error]:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
