import { StreamClient } from '@stream-io/node-sdk';
import type { Caller } from '@/lib/caller';

/**
 * Stream token for the caller. The user ID always comes from the server-side
 * identity (Clerk session or signed guest cookie), never from the browser.
 * Guest tokens never outlive the guest session.
 */
export const createStreamTokenFor = (caller: Caller): string => {
  const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
  const secret = process.env.STREAM_SECRET_KEY;
  if (!apiKey || !secret) throw new Error('Stream credentials not configured');

  const now = Math.floor(Date.now() / 1000);
  const dayFromNow = now + 24 * 3600;
  const expirationTime = caller.kind === 'guest' ? Math.min(caller.exp, dayFromNow) : dayFromNow;
  const issuedAt = now - 60;

  return new StreamClient(apiKey, secret).createToken(caller.id, expirationTime, issuedAt);
};
