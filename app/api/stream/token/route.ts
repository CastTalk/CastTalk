import { NextResponse } from 'next/server';
import { getCaller } from '@/lib/caller';
import { createStreamTokenFor } from '@/lib/stream-token';

// Never prerender at build time: every request needs the live session/DB.
export const dynamic = 'force-dynamic';

// Fallback for the tokenProvider server action. Identity comes only from the
// Clerk session or the signed guest cookie; any ?userId= is ignored on purpose.
export async function GET() {
  const caller = getCaller();
  if (!caller) {
    return NextResponse.json({ error: 'User is not authenticated' }, { status: 401 });
  }
  try {
    return NextResponse.json({ token: createStreamTokenFor(caller) });
  } catch (error) {
    console.error('[API Stream Token Error]:', error);
    return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
  }
}
