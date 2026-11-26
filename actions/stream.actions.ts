'use server';

import { auth } from '@clerk/nextjs';
import { StreamClient } from '@stream-io/node-sdk';

/**
 * Issues a Stream token for the signed-in Clerk user.
 *
 * The user ID always comes from the server-side Clerk session, never from the
 * caller. Accepting an ID from the browser would let any signed-in user mint a
 * token for someone else (for example the meeting host).
 */
export const tokenProvider = async () => {
  const STREAM_API_KEY = process.env.NEXT_PUBLIC_STREAM_API_KEY;
  const STREAM_API_SECRET = process.env.STREAM_SECRET_KEY;

  const { userId } = auth();
  if (!userId) {
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

    return streamClient.createToken(userId, expirationTime, issuedAt);
  } catch (error) {
    console.error('[stream.actions] Failed to generate Stream token:', error);
    throw new Error('Failed to generate Stream token');
  }
};
