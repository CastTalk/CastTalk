import nodemailer from 'nodemailer';
import path from 'path';
import fs from 'fs';

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 465,
  secure: process.env.SMTP_SECURE !== 'false',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
  attachments?: any[];
}

export async function sendEmail({ to, subject, text, html, replyTo, attachments }: SendEmailOptions) {
  const logoPath = path.join(process.cwd(), 'public', 'logo', 'Bloom.svg');
  const defaultAttachments = fs.existsSync(logoPath)
    ? [{ filename: 'Bloom.svg', path: logoPath, cid: 'bloomLogo' }]
    : [];

  const mailOptions = {
    from: process.env.SMTP_FROM_EMAIL || `"CastTalk" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
    html,
    replyTo,
    attachments: attachments || defaultAttachments,
  };

  return await transporter.sendMail(mailOptions);
}
