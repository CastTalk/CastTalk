import { NextResponse } from 'next/server';
import { appwrite } from '@/lib/appwrite';
import { auth } from '@clerk/nextjs';
import { Query, ID } from 'node-appwrite';
import crypto from 'crypto';
import { getUserEmail, sendScheduledConfirmationEmail, send1HourPrepEmail, sendTomorrowReminderEmail } from '@/lib/mail-templates';



function getNotificationId(prefix: string, meetingId: string, suffix?: string | number): string {
  const input = suffix ? `${prefix}_${meetingId}_${suffix}` : `${prefix}_${meetingId}`;
  return crypto.createHash('md5').update(input).digest('hex');
}

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

      const formattedTime = new Date(startsAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      const timestamp = Date.now();
      await appwrite.databases.createDocument(
        DATABASE_ID,
        'notifications',
        getNotificationId('resched', meetingId, timestamp),
        {
          userId: activeUserId,
          text: `${title} has been rescheduled to ${formattedTime}.`,
          read: false,
          type: 'update',
          createdAt: new Date().toISOString()
        }
      ).catch((e: any) => console.error('[Create Rescheduled Notification Error]:', e));

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

        const formattedTime = new Date(startsAt).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        await appwrite.databases.createDocument(
          DATABASE_ID,
          'notifications',
          ID.unique(),
          {
            userId: activeUserId,
            text: `${title} scheduled for ${formattedTime}.`,
            read: false,
            type: meetingType === 'instant' ? 'success' : (meetingType === 'ai' ? 'ai' : 'scheduled'),
            createdAt: new Date().toISOString()
          }
        ).catch((e: any) => console.error('[Create Scheduled Notification Error]:', e));

        // Send email notifications
        getUserEmail(activeUserId)
          .then(async (userEmail) => {
            if (!userEmail) return;

            // 1. Send confirmation email
            await sendScheduledConfirmationEmail({
              meetingId,
              title,
              startsAt,
              duration: Number(duration),
              description,
              recipientEmail: userEmail,
            }).catch((e: any) => console.error('[Confirmation Email Error]:', e));

            // Calculate diffMins for immediate reminders if scheduled near start time
            const nowMs = Date.now();
            const startsAtTime = new Date(startsAt).getTime();
            const diffMins = (startsAtTime - nowMs) / 60000;

            // 2. If starts in 30-60 mins, send 1-hour prep email immediately
            if (diffMins > 30 && diffMins <= 60) {
              await send1HourPrepEmail({
                meetingId,
                title,
                startsAt,
                duration: Number(duration),
                description,
                recipientEmail: userEmail,
              }).catch((e: any) => console.error('[Immediate 1-Hour Email Error]:', e));
            }

            // 3. If starts tomorrow (18h to 28h), send tomorrow reminder email immediately
            if (diffMins > 18 * 60 && diffMins <= 28 * 60) {
              await sendTomorrowReminderEmail({
                meetingId,
                title,
                startsAt,
                duration: Number(duration),
                description,
                recipientEmail: userEmail,
              }).catch((e: any) => console.error('[Immediate Tomorrow Email Error]:', e));
            }
          })
          .catch((e: any) => console.error('[Send Scheduled Emails Error]:', e));



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
    let existing;
    try {
      existing = await appwrite.databases.getDocument(DATABASE_ID, COLLECTION_ID, meetingId);
    } catch (err: any) {
      if (err.code === 404) {
        // Document already doesn't exist in Appwrite database
        return NextResponse.json({ success: true, message: 'Schedule does not exist in database' });
      }
      throw err;
    }

    if (existing.createdBy !== activeUserId) {
      return NextResponse.json({ error: 'Unauthorized: Schedule belongs to a different user' }, { status: 403 });
    }

    // Hard delete schedule from Appwrite database
    await appwrite.databases.deleteDocument(DATABASE_ID, COLLECTION_ID, meetingId);

    const timestamp = Date.now();
    const startsAtTime = new Date(existing.startsAt).getTime();
    const isPast = startsAtTime < Date.now();
    const cancelMsg = isPast
      ? `${existing.title} has been deleted.`
      : `${existing.title} has been cancelled.`;

    await appwrite.databases.createDocument(
      DATABASE_ID,
      'notifications',
      getNotificationId('cancel', meetingId, timestamp),
      {
        userId: activeUserId,
        text: cancelMsg,
        read: false,
        type: 'cancelled',
        createdAt: new Date().toISOString()
      }
    ).catch((e: any) => console.error('[Create Cancel Notification Error]:', e));

    // Find and clean up participant schedule entries (copies of this meeting with different createdBy)
    try {
      const participantSchedules = await appwrite.databases.listDocuments(
        DATABASE_ID,
        COLLECTION_ID,
        [
          Query.equal('meetingId', meetingId),
          Query.notEqual('createdBy', activeUserId),
          Query.limit(100)
        ]
      );

      const participantCancelMsg = isPast
        ? `${existing.title} has been deleted by the host.`
        : `${existing.title} has been cancelled by the host.`;

      // Notify each participant and delete their schedule entry
      await Promise.all(
        participantSchedules.documents.map(async (doc: any) => {
          // Create cancellation notification for participant
          await appwrite.databases.createDocument(
            DATABASE_ID,
            'notifications',
            getNotificationId('cancel', meetingId, `${doc.createdBy}_${timestamp}`),
            {
              userId: doc.createdBy,
              text: participantCancelMsg,
              read: false,
              type: 'cancelled',
              createdAt: new Date().toISOString()
            }
          ).catch((e: any) => console.error('[Participant Cancel Notification Error]:', e));

          // Delete participant's schedule entry
          await appwrite.databases.deleteDocument(DATABASE_ID, COLLECTION_ID, doc.$id)
            .catch((e: any) => console.error('[Delete Participant Schedule Error]:', e));
        })
      );
    } catch (e: any) {
      console.error('[Find Participant Schedules Error]:', e);
    }

    // Clean up corresponding active/time-based notifications for the host
    const activeNotifs = [
      getNotificationId('sched', meetingId),
      getNotificationId('prep', meetingId),
      getNotificationId('soon', meetingId),
      getNotificationId('started', meetingId),
      getNotificationId('past', meetingId),
      getNotificationId('done', meetingId)
    ];
    await Promise.all(
      activeNotifs.map(id =>
        appwrite.databases.deleteDocument(DATABASE_ID, 'notifications', id)
          .catch((err: any) => {
            if (err.code !== 404) {
              console.error('[Clean Up Notification Error]:', err);
            }
          })
      )
    );

    return NextResponse.json({ success: true, message: 'Schedule hard deleted from database' });
  } catch (error: any) {
    console.error('[Delete Schedule API Error]:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
