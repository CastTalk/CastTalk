'use server';

import { getCaller } from '@/lib/caller';
import { createStreamTokenFor } from '@/lib/stream-token';

/**
 * Issues a Stream token for the signed-in member, or for the current guest
 * session. The identity comes from the server (Clerk session / signed guest
 * cookie), never from the caller, so nobody can mint a token for someone else.
 */
export const tokenProvider = async () => {
  const caller = getCaller();
  if (!caller) {
    throw new Error('User is not authenticated');
  }
  try {
    return createStreamTokenFor(caller);
  } catch (error) {
    console.error('[stream.actions] Failed to generate Stream token:', error);
    throw new Error('Failed to generate Stream token');
  }
};
