'use server';

import { auth } from '@clerk/nextjs';
import { StreamClient } from '@stream-io/node-sdk';

export const tokenProvider = async (userId?: string) => {
  const STREAM_API_KEY = process.env.NEXT_PUBLIC_STREAM_API_KEY;
  const STREAM_API_SECRET = process.env.STREAM_SECRET_KEY;

  let clerkUserId: string | null = null;
  try {
    const authData = auth();
    clerkUserId = authData?.userId || null;
  } catch (err) {
    console.warn('[stream.actions] auth() warning:', err);
  }

  const activeUserId = userId || clerkUserId;

  if (!activeUserId) {
    console.error('[stream.actions] User is not authenticated and no userId was provided.');
    throw new Error('User is not authenticated');
  }

  if (!STREAM_API_KEY) {
    console.error('[stream.actions] NEXT_PUBLIC_STREAM_API_KEY is missing.');
    throw new Error('Stream API key is missing');
  }

  if (!STREAM_API_SECRET) {
    console.error('[stream.actions] STREAM_SECRET_KEY is missing.');
    throw new Error('Stream API secret is missing');
  }

  try {
    const streamClient = new StreamClient(STREAM_API_KEY, STREAM_API_SECRET);

    const expirationTime = Math.floor(Date.now() / 1000) + 24 * 3600;
    const issuedAt = Math.floor(Date.now() / 1000) - 60;

    const token = streamClient.createToken(activeUserId, expirationTime, issuedAt);

    return token;
  } catch (error) {
    console.error('[stream.actions] Failed to generate Stream token:', error);
    throw new Error('Failed to generate Stream token');
  }
};
