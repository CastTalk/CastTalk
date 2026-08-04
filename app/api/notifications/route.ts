import { NextResponse } from 'next/server';
import { appwrite } from '@/lib/appwrite';
import { auth } from '@clerk/nextjs';
import { Query, ID } from 'node-appwrite';
import crypto from 'crypto';
import { getUserEmail, send1HourPrepEmail, sendTomorrowReminderEmail } from '@/lib/mail-templates';


function getNotificationId(prefix: string, meetingId: string, suffix?: string | number): string {
  const input = suffix ? `${prefix}_${meetingId}_${suffix}` : `${prefix}_${meetingId}`;
  return crypto.createHash('md5').update(input).digest('hex');
}

const DATABASE_ID = 'castdb';
const COLLECTION_ID = 'notifications';

export async function GET(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch current notifications (limit to 100 to check set for existing notifications)
    const response = await appwrite.databases.listDocuments(
      DATABASE_ID,
      COLLECTION_ID,
      [
        Query.equal('userId', userId),
        Query.orderDesc('createdAt'),
        Query.limit(100)
      ]
    );

    const existingNotifIds = new Set(response.documents.map((doc: any) => doc.$id));

    // 2. Fetch all user schedules
    const schedulesResponse = await appwrite.databases.listDocuments(
      DATABASE_ID,
      'schedules',
      [
        Query.equal('createdBy', userId),
        Query.orderDesc('startsAt'),
        Query.limit(100)
      ]
    );

    const now = new Date();
    const nowMs = now.getTime();
    const cutoffMs = 24 * 60 * 60 * 1000; // Only generate notifications for events in the last 24 hours

    const userEmail = await getUserEmail(userId);
    const notificationPromises: Promise<any>[] = [];

    for (const schedule of schedulesResponse.documents) {
      const startsAtTime = new Date(schedule.startsAt).getTime();
      const durationMins = Number(schedule.duration || 60);
      const durationMs = durationMins * 60000;
      const endsAtTime = startsAtTime + durationMs;
      const title = schedule.title;
      const meetingId = schedule.meetingId;
      const description = schedule.description;

      // Skip historical meetings older than 24 hours
      if (nowMs - startsAtTime > cutoffMs) {
        continue;
      }

      const formattedTime = new Date(schedule.startsAt).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      const diffMins = (startsAtTime - nowMs) / 60000;

      // EMAIL 1: Tomorrow / 24-Hour Reminder Email (between 18h and 28h away)
      if (diffMins > 18 * 60 && diffMins <= 28 * 60 && userEmail) {
        const email24hId = getNotificationId('email_24h', meetingId);
        if (!existingNotifIds.has(email24hId)) {
          existingNotifIds.add(email24hId);
          notificationPromises.push(
            sendTomorrowReminderEmail({
              meetingId,
              title,
              startsAt: schedule.startsAt,
              duration: durationMins,
              description,
              recipientEmail: userEmail,
            })
              .then(() =>
                appwrite.databases.createDocument(DATABASE_ID, COLLECTION_ID, email24hId, {
                  userId,
                  text: `Email reminder sent for tomorrow: ${title}`,
                  read: true,
                  type: 'email',
                  createdAt: new Date().toISOString(),
                })
              )
              .catch((err: any) => console.error('[Tomorrow Email Error]:', err))
          );
        }
      }

      // EMAIL 2: 1-Hour Prep Reminder Email (between 30m and 60m away)
      if (diffMins > 30 && diffMins <= 60 && userEmail) {
        const email1hId = getNotificationId('email_1h', meetingId);
        if (!existingNotifIds.has(email1hId)) {
          existingNotifIds.add(email1hId);
          notificationPromises.push(
            send1HourPrepEmail({
              meetingId,
              title,
              startsAt: schedule.startsAt,
              duration: durationMins,
              description,
              recipientEmail: userEmail,
            })
              .then(() =>
                appwrite.databases.createDocument(DATABASE_ID, COLLECTION_ID, email1hId, {
                  userId,
                  text: `1-Hour Prep Email sent: ${title}`,
                  read: true,
                  type: 'email',
                  createdAt: new Date().toISOString(),
                })
              )
              .catch((err: any) => console.error('[1-Hour Prep Email Error]:', err))
          );
        }
      }

      // 1. Preparation alert (starts in > 30 and <= 60 minutes)
      if (diffMins > 30 && diffMins <= 60) {
        const customId = getNotificationId('prep', meetingId);
        if (!existingNotifIds.has(customId)) {
          const text = `${title} starts in 1 hour. Please prepare and standby.`;
          notificationPromises.push(
            appwrite.databases.createDocument(
              DATABASE_ID,
              COLLECTION_ID,
              customId,
              {
                userId,
                text,
                read: false,
                type: 'alert',
                createdAt: new Date().toISOString()
              }
            ).catch((err: any) => {
              if (err.code !== 409) {
                console.error('[Generate Notification Error - prep]:', err);
              }
            })
          );
        }
      }


      // 2. Starting soon (starts in > 5 and <= 30 minutes)
      if (diffMins > 5 && diffMins <= 30) {
        const customId = getNotificationId('soon', meetingId);
        if (!existingNotifIds.has(customId)) {
          const text = `${title} starts in less than 30 minutes.`;
          notificationPromises.push(
            appwrite.databases.createDocument(
              DATABASE_ID,
              COLLECTION_ID,
              customId,
              {
                userId,
                text,
                read: false,
                type: 'alert',
                createdAt: new Date().toISOString()
              }
            ).catch((err: any) => {
              if (err.code !== 409) {
                console.error('[Generate Notification Error - soon]:', err);
              }
            })
          );
        }
      }

      // 3. Actual Start Time (started) (starts in <= 5 mins, and not ended yet)
      if (diffMins <= 5 && diffMins > -5) {
        const customId = getNotificationId('started', meetingId);
        if (!existingNotifIds.has(customId)) {
          const text = `${title} has started.`;
          notificationPromises.push(
            appwrite.databases.createDocument(
              DATABASE_ID,
              COLLECTION_ID,
              customId,
              {
                userId,
                text,
                read: false,
                type: 'alert',
                createdAt: new Date().toISOString()
              }
            ).catch((err: any) => {
              if (err.code !== 409) {
                console.error('[Generate Notification Error - started]:', err);
              }
            })
          );
        }
      }

      // 2. Way past schedule (past by > 15 mins, and not ended yet)
      if (nowMs - startsAtTime > 15 * 60000 && nowMs < endsAtTime) {
        const customId = getNotificationId('past', meetingId);
        if (!existingNotifIds.has(customId)) {
          const text = `${title} scheduled for ${formattedTime} is way past its schedule.`;
          notificationPromises.push(
            appwrite.databases.createDocument(
              DATABASE_ID,
              COLLECTION_ID,
              customId,
              {
                userId,
                text,
                read: false,
                type: 'alert',
                createdAt: new Date().toISOString()
              }
            ).catch((err: any) => {
              if (err.code !== 409) {
                console.error('[Generate Notification Error - past]:', err);
              }
            })
          );
        }
      }

      // 3. Meeting is now done (past endsAtTime)
      if (nowMs >= endsAtTime) {
        const customId = getNotificationId('done', meetingId);
        if (!existingNotifIds.has(customId)) {
          const text = `${title} is now done.`;
          notificationPromises.push(
            appwrite.databases.createDocument(
              DATABASE_ID,
              COLLECTION_ID,
              customId,
              {
                userId,
                text,
                read: false,
                type: 'success',
                createdAt: new Date().toISOString()
              }
            ).catch((err: any) => {
              if (err.code !== 409) {
                console.error('[Generate Notification Error - done]:', err);
              }
            })
          );
        }
      }

      // 4. Fallback (scheduled successfully)
      const schedCustomId = getNotificationId('sched', meetingId);
      if (!existingNotifIds.has(schedCustomId)) {
        const formattedDate = new Date(schedule.startsAt).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        const text = `${title} scheduled for ${formattedDate}.`;
        notificationPromises.push(
          appwrite.databases.createDocument(
            DATABASE_ID,
            COLLECTION_ID,
            schedCustomId,
            {
              userId,
              text,
              read: false,
              type: schedule.meetingType === 'instant' ? 'success' : (schedule.meetingType === 'ai' ? 'ai' : 'scheduled'),
              createdAt: schedule.$createdAt || new Date().toISOString()
            }
          ).catch((err: any) => {
            if (err.code !== 409) {
              console.error('[Generate Notification Error - sched]:', err);
            }
          })
        );
      }
    }

    // Wait for all newly generated notifications to be created in DB
    if (notificationPromises.length > 0) {
      await Promise.all(notificationPromises);
    }

    // 3. Fetch final fresh list of notifications to return
    const finalResponse = await appwrite.databases.listDocuments(
      DATABASE_ID,
      COLLECTION_ID,
      [
        Query.equal('userId', userId),
        Query.orderDesc('createdAt'),
        Query.limit(50)
      ]
    );

    const notifications = finalResponse.documents.map((doc: any) => ({
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
    const clearAll = searchParams.get('clearAll');

    if (clearAll === 'true') {
      // Clear all notifications for activeUserId (soft delete to prevent regeneration)
      const userNotifs = await appwrite.databases.listDocuments(
        DATABASE_ID,
        COLLECTION_ID,
        [
          Query.equal('userId', activeUserId),
          Query.limit(100)
        ]
      );
      const softDeletes = userNotifs.documents.map(async (doc) => {
        return appwrite.databases.updateDocument(DATABASE_ID, COLLECTION_ID, doc.$id, { type: 'deleted' });
      });
      await Promise.all(softDeletes);
      return NextResponse.json({ success: true, message: 'All notifications cleared' });
    }

    if (!id) {
      return NextResponse.json({ error: 'Notification ID is required' }, { status: 400 });
    }

    // Security check: verify document belongs to activeUserId
    const doc = await appwrite.databases.getDocument(DATABASE_ID, COLLECTION_ID, id);
    if (doc.userId !== activeUserId) {
      return NextResponse.json({ error: 'Unauthorized: Notification belongs to a different user' }, { status: 403 });
    }

    // Soft delete notification by setting its type to 'deleted' so it doesn't get regenerated by GET
    await appwrite.databases.updateDocument(DATABASE_ID, COLLECTION_ID, id, { type: 'deleted' });
    return NextResponse.json({ success: true, message: 'Notification marked as deleted' });
  } catch (error: any) {
    console.error('[Delete Notification Error]:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
