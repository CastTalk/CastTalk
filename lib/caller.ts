import { auth } from '@clerk/nextjs';
import { getGuestSession } from '@/lib/guest-session';

export type Caller =
  | { kind: 'member'; id: string }
  | { kind: 'guest'; id: string; name: string; exp: number };

/**
 * Who is making this request: a signed-in Clerk member, a guest with a valid
 * signed session cookie, or nobody. A Clerk session always wins over a guest
 * cookie. Use in routes that guests are allowed to call; everything else keeps
 * requiring `auth().userId`.
 */
export const getCaller = (): Caller | null => {
  const { userId } = auth();
  if (userId) return { kind: 'member', id: userId };
  const guest = getGuestSession();
  return guest ? { kind: 'guest', ...guest } : null;
};
