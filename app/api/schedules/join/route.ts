import { NextResponse } from 'next/server';
import { appwrite } from '@/lib/appwrite';
import { auth } from '@clerk/nextjs';
import { Query } from 'node-appwrite';
import crypto from 'crypto';
import { StreamClient } from '@stream-io/node-sdk';

const STREAM_API_KEY = process.env.NEXT_PUBLIC_STREAM_API_KEY;
const STREAM_API_SECRET = process.env.STREAM_SECRET_KEY;

function getNotificationId(prefix: string, meetingId: string, suffix?: string | number): string {
  const input = suffix ? `${prefix}_${meetingId}_${suffix}` : `${prefix}_${meetingId}`;
  return crypto.createHash('md5').update(input).digest('hex');
}

const DATABASE_ID = 'castdb';
const SCHEDULES_COLLECTION = 'schedules';
const NOTIFICATIONS_COLLECTION = 'notifications';

/**
 * POST /api/schedules/join
 * 
 * Allows a non-host user to add a scheduled meeting to their own calendar.
 * This creates a participant schedule entry so they receive time-based notifications.
 * 
 * Body: { meetingId: string }
 */
export async function POST(req: Request) {
  try {
    const { userId: activeUserId } = auth();
    if (!activeUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { meetingId } = await req.json();

    if (!meetingId) {
      return NextResponse.json({ error: 'Meeting ID is required' }, { status: 400 });
    }

    // 1. Look up the original schedule document
    let schedule;
    try {
      schedule = await appwrite.databases.getDocument(DATABASE_ID, SCHEDULES_COLLECTION, meetingId);
    } catch (err: any) {
      if (err.code === 404) {
        return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
      }
      throw err;
    }

    // 2. Check if the user is the host (no need to add themselves)
    if (schedule.createdBy === activeUserId) {
      return NextResponse.json({ 
        success: true, 
        message: 'You are the host of this meeting — it is already in your calendar.',
        schedule: {
          meetingId: schedule.meetingId,
          title: schedule.title,
          description: schedule.description,
          startsAt: schedule.startsAt,
          duration: schedule.duration,
          meetingType: schedule.meetingType,
        },
        alreadyHost: true
      });
    }

    // 3. Check if user already has this meeting in their calendar (avoid duplicates)
    // We use a deterministic document ID based on meetingId + userId
    const participantDocId = crypto.createHash('md5').update(`participant_${meetingId}_${activeUserId}`).digest('hex');
    
    try {
      const existing = await appwrite.databases.getDocument(DATABASE_ID, SCHEDULES_COLLECTION, participantDocId);
      // Already exists — return success without creating duplicate
      return NextResponse.json({ 
        success: true, 
        message: 'This meeting is already in your calendar.',
        schedule: {
          meetingId: existing.meetingId,
          title: existing.title,
          description: existing.description,
          startsAt: existing.startsAt,
          duration: existing.duration,
          meetingType: existing.meetingType,
        },
        alreadyAdded: true
      });
    } catch (err: any) {
      if (err.code !== 404) throw err;
      // Document doesn't exist yet — proceed to create
    }

    // 4. Create a participant schedule entry (mirrors the host's schedule but with participant's userId)
    const participantSchedule = await appwrite.databases.createDocument(
      DATABASE_ID,
      SCHEDULES_COLLECTION,
      participantDocId,
      {
        meetingId: schedule.meetingId,
        title: schedule.title,
        description: schedule.description || '',
        startsAt: schedule.startsAt,
        duration: Number(schedule.duration),
        meetingType: schedule.meetingType,
        createdBy: activeUserId, // This is the participant's userId — they "own" this calendar entry
      }
    );

    // Add participant to Stream Call members so Stream queryCalls includes this call on their calendar
    if (STREAM_API_KEY && STREAM_API_SECRET) {
      try {
        const streamClient = new StreamClient(STREAM_API_KEY, STREAM_API_SECRET);
        const streamCall = streamClient.video.call('default', meetingId);
        await streamCall.getOrCreate({
          data: {
            members: [{ user_id: activeUserId }]
          }
        }).catch(e => console.error('[Stream getOrCreate member error]:', e));
      } catch (e) {
        console.error('[Stream Client Init Error]:', e);
      }
    }

    // 5. Create a notification for the participant
    const formattedTime = new Date(schedule.startsAt).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    const timestamp = Date.now();
    await appwrite.databases.createDocument(
      DATABASE_ID,
      NOTIFICATIONS_COLLECTION,
      getNotificationId('joined', meetingId, `${activeUserId}_${timestamp}`),
      {
        userId: activeUserId,
        text: `${schedule.title} scheduled for ${formattedTime} has been added to your calendar.`,
        read: false,
        type: 'scheduled',
        createdAt: new Date().toISOString()
      }
    ).catch((e: any) => console.error('[Create Join Notification Error]:', e));

    return NextResponse.json({ 
      success: true, 
      message: 'Meeting added to your calendar!',
      schedule: {
        meetingId: participantSchedule.meetingId,
        title: participantSchedule.title,
        description: participantSchedule.description,
        startsAt: participantSchedule.startsAt,
        duration: participantSchedule.duration,
        meetingType: participantSchedule.meetingType,
      }
    });
  } catch (error: any) {
    console.error('[Join Schedule API Error]:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * GET /api/schedules/join?meetingId=xxx
 * 
 * Check if a meeting is a scheduled meeting and return its details.
 * Used by the client to determine if the join modal should be shown.
 */
export async function GET(req: Request) {
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

    // Look up the schedule
    let schedule;
    try {
      schedule = await appwrite.databases.getDocument(DATABASE_ID, SCHEDULES_COLLECTION, meetingId);
    } catch (err: any) {
      if (err.code === 404) {
        // Not a scheduled meeting (could be an instant meeting not tracked in schedules)
        return NextResponse.json({ isScheduled: false });
      }
      throw err;
    }

    const startsAt = new Date(schedule.startsAt);
    const now = new Date();
    const isScheduled = schedule.meetingType !== 'instant';
    const isFuture = startsAt.getTime() > now.getTime();
    const isHost = schedule.createdBy === activeUserId;

    // Check if user already has this in their calendar
    const participantDocId = crypto.createHash('md5').update(`participant_${meetingId}_${activeUserId}`).digest('hex');
    let alreadyAdded = false;
    try {
      await appwrite.databases.getDocument(DATABASE_ID, SCHEDULES_COLLECTION, participantDocId);
      alreadyAdded = true;
    } catch (err: any) {
      if (err.code !== 404) throw err;
    }

    return NextResponse.json({
      isScheduled,
      isFuture,
      isHost,
      alreadyAdded,
      schedule: {
        meetingId: schedule.meetingId,
        title: schedule.title,
        description: schedule.description,
        startsAt: schedule.startsAt,
        duration: schedule.duration,
        meetingType: schedule.meetingType,
      }
    });
  } catch (error: any) {
    console.error('[Check Schedule API Error]:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
