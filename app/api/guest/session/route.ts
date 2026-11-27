import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import {
  GUEST_COOKIE,
  cleanGuestName,
  createGuestSession,
  encodeGuestSession,
  getGuestSession,
  guestCookieOptions,
} from '@/lib/guest-session';

// Never prerender at build time: every request needs the live session.
export const dynamic = 'force-dynamic';

/** Current guest session (from the signed cookie), or { guest: null }. */
export async function GET() {
  const session = getGuestSession();
  return NextResponse.json({ guest: session ? { id: session.id, name: session.name, exp: session.exp } : null });
}

/** Start a guest session. The server picks the ID; the client only supplies a display name. */
export async function POST(req: Request) {
  const { userId } = auth();
  if (userId) {
    return NextResponse.json({ error: 'Already signed in' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const name = cleanGuestName(body?.name);
  if (!name) {
    return NextResponse.json({ error: 'Enter a name between 1 and 40 characters' }, { status: 400 });
  }

  const session = createGuestSession(name);
  const res = NextResponse.json({ guest: { id: session.id, name: session.name, exp: session.exp } });
  res.cookies.set(GUEST_COOKIE, encodeGuestSession(session), guestCookieOptions);
  return res;
}

/** End the guest session (leaving guest mode, or after signing in). */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(GUEST_COOKIE, '', { ...guestCookieOptions, maxAge: 0 });
  return res;
}
