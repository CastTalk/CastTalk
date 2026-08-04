import { NextResponse } from 'next/server';
import { appwrite } from '@/lib/appwrite';
import { Query } from 'node-appwrite';
import crypto from 'crypto';
import { getUserEmail, send1HourPrepEmail, sendTomorrowReminderEmail } from '@/lib/mail-templates';

function getNotificationId(prefix: string, meetingId: string, suffix?: string | number): string {
  const input = suffix ? `${prefix}_${meetingId}_${suffix}` : `${prefix}_${meetingId}`;
  return crypto.createHash('md5').update(input).digest('hex');
}

const DATABASE_ID = 'castdb';
const SCHEDULES_COLLECTION = 'schedules';
const NOTIFICATIONS_COLLECTION = 'notifications';

export async function GET(req: Request) {
  try {
    // Verify Cron Secret if set in env (Vercel Cron security best practice)
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized Cron Invocation' }, { status: 401 });
    }

    const now = new Date();
    const nowMs = now.getTime();

    // 1. Fetch upcoming schedules across all users
    const schedulesResponse = await appwrite.databases.listDocuments(
      DATABASE_ID,
      SCHEDULES_COLLECTION,
      [
        Query.orderAsc('startsAt'),
        Query.limit(200)
      ]
    );

    let processedCount = 0;
    let emailsSent = 0;

    for (const schedule of schedulesResponse.documents) {
      const startsAtTime = new Date(schedule.startsAt).getTime();
      const diffMins = (startsAtTime - nowMs) / 60000;
      const meetingId = schedule.meetingId;
      const title = schedule.title;
      const description = schedule.description;
      const durationMins = Number(schedule.duration || 60);
      const userId = schedule.createdBy;

      // Skip past meetings
      if (diffMins < 0) continue;

      processedCount++;

      // Cache user email lookup per schedule
      const userEmail = userId ? await getUserEmail(userId) : null;
      if (!userEmail) continue;

      // 1. Check for 1-Hour Prep Email (starts in 30 to 60 mins)
      if (diffMins > 30 && diffMins <= 60) {
        const email1hId = getNotificationId('email_1h', meetingId);
        try {
          // Check if already sent
          await appwrite.databases.getDocument(DATABASE_ID, NOTIFICATIONS_COLLECTION, email1hId);
        } catch (err: any) {
          if (err.code === 404) {
            // Not sent yet -> send email and record document
            await send1HourPrepEmail({
              meetingId,
              title,
              startsAt: schedule.startsAt,
              duration: durationMins,
              description,
              recipientEmail: userEmail,
            });

            await appwrite.databases.createDocument(
              DATABASE_ID,
              NOTIFICATIONS_COLLECTION,
              email1hId,
              {
                userId,
                text: `1-Hour Prep Email sent: ${title}`,
                read: true,
                type: 'email',
                createdAt: new Date().toISOString(),
              }
            );

            emailsSent++;
          }
        }
      }

      // 2. Check for Tomorrow / 24-Hour Reminder Email (starts in 18h to 28h)
      if (diffMins > 18 * 60 && diffMins <= 28 * 60) {
        const email24hId = getNotificationId('email_24h', meetingId);
        try {
          // Check if already sent
          await appwrite.databases.getDocument(DATABASE_ID, NOTIFICATIONS_COLLECTION, email24hId);
        } catch (err: any) {
          if (err.code === 404) {
            // Not sent yet -> send email and record document
            await sendTomorrowReminderEmail({
              meetingId,
              title,
              startsAt: schedule.startsAt,
              duration: durationMins,
              description,
              recipientEmail: userEmail,
            });

            await appwrite.databases.createDocument(
              DATABASE_ID,
              NOTIFICATIONS_COLLECTION,
              email24hId,
              {
                userId,
                text: `Email reminder sent for tomorrow: ${title}`,
                read: true,
                type: 'email',
                createdAt: new Date().toISOString(),
              }
            );

            emailsSent++;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      processedCount,
      emailsSent,
    });
  } catch (error: any) {
    console.error('[Vercel Cron Reminders Error]:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
