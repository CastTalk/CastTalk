import { sendEmail } from './mail';
import { clerkClient } from '@clerk/nextjs';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

interface EmailMeetingParams {
  meetingId: string;
  title: string;
  startsAt: string;
  duration?: number;
  description?: string;
  recipientEmail: string;
  userName?: string;
}

/**
 * Helper to fetch a user's primary email address from Clerk
 */
export async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const user = await clerkClient.users.getUser(userId);
    if (!user) return null;
    const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId);
    return primary?.emailAddress || user.emailAddresses[0]?.emailAddress || null;
  } catch (error) {
    console.error('[getUserEmail Error]:', error);
    return null;
  }
}

/**
 * Format date & time into: "Tue, Aug 4, 2026, 11:00 PM"
 */
function formatMeetingDate(startsAt: string): string {
  const d = new Date(startsAt);
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Clean, Formal Email Layout:
 * - CID embedded Black SVG logo (cid:bloomLogo)
 * - Header: "Ready to join?" (or custom header)
 * - Subheader: "Your meeting for '{Title}' is coming up soon..."
 * - Direct Date & Time with bullet dot separator: "Tue, Aug 4, 2026, 11:00 PM • 60 mins"
 * - Formal and professional button ("Join Meeting")
 * - Minimal app notification footer
 */
function renderEmailLayout({
  header,
  subheader,
  formattedTime,
  description,
  meetingUrl,
  callToActionText,
  extraNotice,
}: {
  header: string;
  subheader?: string;
  formattedTime: string;
  description?: string;
  meetingUrl: string;
  callToActionText: string;
  extraNotice?: string;
}) {
  const currentYear = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${header}</title>
</head>
<body style="margin:0; padding:0; background-color:#ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#0f172a; line-height: 1.5;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff; padding: 40px 24px;">
    <tr>
      <td align="left">
        <table width="560" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto; text-align: left;">
          
          <!-- Top Left Logo (CID embedded SVG) -->
          <tr>
            <td align="left" style="padding-bottom: 24px;">
              <img src="cid:bloomLogo" width="44" height="44" alt="CastTalk Logo" style="display: block; border: 0;" />
            </td>
          </tr>

          <!-- Main Header -->
          <tr>
            <td align="left" style="padding-bottom: 8px;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #0f172a; letter-spacing: -0.5px; line-height: 1.2;">
                ${header}
              </h1>
            </td>
          </tr>

          <!-- Subheader / Introductory Line -->
          ${
            subheader
              ? `<tr>
                  <td align="left" style="padding-bottom: 18px;">
                    <p style="margin: 0; font-size: 15px; color: #334155; line-height: 1.5;">
                      ${subheader}
                    </p>
                  </td>
                </tr>`
              : ''
          }

          <!-- Meeting Details & Content -->
          <tr>
            <td align="left" style="padding-bottom: 32px;">
              <!-- Clean Date, Time & Duration Line with Bullet Dot Separator -->
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #475569; font-weight: 500;">
                ${formattedTime}
              </p>
              
              ${description ? `<p style="margin: 0 0 16px 0; font-size: 14px; color: #64748b; line-height: 1.6;">${description}</p>` : ''}
              
              ${
                extraNotice
                  ? `<div style="margin: 0 0 24px 0; font-size: 14px; color: #0f766e; background-color: #f0fdf4; border-left: 3px solid #10b981; padding: 12px 16px; border-radius: 4px;">
                      ${extraNotice}
                    </div>`
                  : ''
              }

              <!-- Formal Professional Button -->
              <div style="margin-top: 24px;">
                <a href="${meetingUrl}" target="_blank" style="background-color: #0f172a; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 24px; border-radius: 6px; display: inline-block;">
                  ${callToActionText}
                </a>
              </div>
            </td>
          </tr>

          <!-- Clean App Footer -->
          <tr>
            <td style="border-top: 1px solid #e2e8f0; padding-top: 28px; text-align: left;">
              <div style="margin-bottom: 8px;">
                <span style="font-size: 14px; font-weight: 700; color: #0f172a;">CastTalk</span>
                <span style="font-size: 12px; color: #64748b; margin-left: 8px;">Smart AI Video Conferencing</span>
              </div>
              <p style="margin: 0 0 12px 0; font-size: 12px; color: #64748b;">
                You received this notification because you are a scheduled participant on CastTalk.
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                &copy; ${currentYear} CastTalk. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * 1. Send Email for 1-Hour Prep Reminder
 */
export async function send1HourPrepEmail({
  meetingId,
  title,
  startsAt,
  duration,
  description,
  recipientEmail,
}: EmailMeetingParams) {
  const dateStr = formatMeetingDate(startsAt);
  const formattedTime = `${dateStr}${duration ? ` &bull; ${duration} mins` : ''}`;
  const meetingUrl = `${BASE_URL}/meeting/${meetingId}`;

  const html = renderEmailLayout({
    header: 'Ready to join?',
    subheader: `Your meeting for "${title}" is coming up soon. Here are the details for your upcoming session:`,
    formattedTime,
    description,
    meetingUrl,
    callToActionText: 'Join Meeting',
    extraNotice: 'Your meeting starts in 1 hour. Please verify your camera and microphone setup before joining.',
  });

  return await sendEmail({
    to: recipientEmail,
    subject: `CastTalk - Scheduled Meeting Underway: ${title}`,
    html,
  });
}

/**
 * 2. Send Email for Tomorrow / 24-Hour Reminder
 */
export async function sendTomorrowReminderEmail({
  meetingId,
  title,
  startsAt,
  duration,
  description,
  recipientEmail,
}: EmailMeetingParams) {
  const dateStr = formatMeetingDate(startsAt);
  const formattedTime = `${dateStr}${duration ? ` &bull; ${duration} mins` : ''}`;
  const meetingUrl = `${BASE_URL}/meeting/${meetingId}`;

  const html = renderEmailLayout({
    header: 'Upcoming Meeting Tomorrow',
    subheader: `Your scheduled meeting for "${title}" is tomorrow. Here are the details:`,
    formattedTime,
    description,
    meetingUrl,
    callToActionText: 'View Meeting Details',
    extraNotice: 'Reminder: You have a scheduled meeting tomorrow. Please ensure your schedule is clear.',
  });

  return await sendEmail({
    to: recipientEmail,
    subject: `CastTalk - Upcoming Meeting Tomorrow: ${title}`,
    html,
  });
}

/**
 * 3. Send Email Confirmation when a meeting is newly scheduled
 */
export async function sendScheduledConfirmationEmail({
  meetingId,
  title,
  startsAt,
  duration,
  description,
  recipientEmail,
}: EmailMeetingParams) {
  const dateStr = formatMeetingDate(startsAt);
  const formattedTime = `${dateStr}${duration ? ` &bull; ${duration} mins` : ''}`;
  const meetingUrl = `${BASE_URL}/meeting/${meetingId}`;

  const html = renderEmailLayout({
    header: 'Scheduled Meeting Confirmation',
    subheader: `Your meeting for "${title}" has been successfully scheduled.`,
    formattedTime,
    description,
    meetingUrl,
    callToActionText: 'Join Meeting',
  });

  return await sendEmail({
    to: recipientEmail,
    subject: `CastTalk - Scheduled Meeting: ${title}`,
    html,
  });
}
