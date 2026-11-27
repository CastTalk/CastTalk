import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

/**
 * Guest sessions: lets people use CastTalk without an account (join and start
 * meetings), Google Meet style.
 *
 * - The SERVER creates the guest ID (`guest_<random>`); the browser never picks
 *   it, so a guest cannot claim someone else's identity.
 * - The identity is an HMAC-SHA256 signed payload in an httpOnly cookie, so page
 *   scripts can neither read nor forge it.
 * - It's a session cookie (no Max-Age): the browser drops it when it closes. The
 *   payload also carries a hard expiry, after which tokens are refused.
 * - Guests are never written to the database; their data stays on the device.
 */

export const GUEST_COOKIE = 'ct_guest';
export const GUEST_TTL_SECONDS = 6 * 60 * 60; // hard cap on a guest session

export type GuestSession = { id: string; name: string; exp: number };

const getSecret = () => {
  const dedicated = process.env.GUEST_SESSION_SECRET;
  if (dedicated) return dedicated;
  // Fallback so guest mode works without extra config: derive a separate key
  // from the Stream secret (never use the secret itself directly).
  const base = process.env.STREAM_SECRET_KEY;
  if (!base) throw new Error('GUEST_SESSION_SECRET or STREAM_SECRET_KEY must be set');
  return createHmac('sha256', base).update('casttalk-guest-session-v1').digest('hex');
};

const sign = (payload: string) => createHmac('sha256', getSecret()).update(payload).digest('base64url');

export const cleanGuestName = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null;
  const name = raw.replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim();
  return name.length >= 1 && name.length <= 40 ? name : null;
};

export const createGuestSession = (name: string): GuestSession => ({
  id: `guest_${randomBytes(9).toString('base64url')}`,
  name,
  exp: Math.floor(Date.now() / 1000) + GUEST_TTL_SECONDS,
});

export const encodeGuestSession = (session: GuestSession) => {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  return `${payload}.${sign(payload)}`;
};

export const decodeGuestSession = (value: string | undefined | null): GuestSession | null => {
  if (!value) return null;
  const [payload, signature] = value.split('.');
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as GuestSession;
    if (typeof session.id !== 'string' || !session.id.startsWith('guest_')) return null;
    if (typeof session.exp !== 'number' || session.exp * 1000 <= Date.now()) return null;
    return { id: session.id, name: cleanGuestName(session.name) ?? 'Guest', exp: session.exp };
  } catch {
    return null;
  }
};

/** The current request's guest session, if any (server components / route handlers). */
export const getGuestSession = (): GuestSession | null => decodeGuestSession(cookies().get(GUEST_COOKIE)?.value);

export const guestCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  // no maxAge/expires => session cookie, disposed when the browser closes
};
