import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs';
import { randomBytes } from 'crypto';
import { appwrite } from '@/lib/appwrite';

// Never prerender at build time: every request needs the live session/DB.
export const dynamic = 'force-dynamic';

/**
 * Mirrors the signed-in Clerk user into Appwrite Auth.
 *
 * Identity, email and name are read from the Clerk session on the server — the
 * request body is ignored — and the Appwrite user record is never returned,
 * because it contains the email and password-hash fields.
 */
export async function POST() {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    try {
      await appwrite.users.get(userId);
      return NextResponse.json({ success: true, created: false });
    } catch (e: any) {
      // Appwrite throws a 404 error if the user ID does not exist in Auth
      const isNotFound = e?.code === 404 || e?.status === 404;
      if (!isNotFound) throw e;
    }

    const clerkUser = await currentUser();
    const email = clerkUser?.emailAddresses?.[0]?.emailAddress || undefined;
    const name =
      [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ') ||
      clerkUser?.username ||
      undefined;

    // Users authenticate through Clerk and never use this password, but Appwrite
    // requires one when an email is set.
    const unusedPassword = `${randomBytes(24).toString('base64url')}A1!`;

    await appwrite.users.create(userId, email, undefined, unusedPassword, name);
    return NextResponse.json({ success: true, created: true });
  } catch (error: any) {
    console.error('[Appwrite Auth Sync] Failed:', error?.message || error);
    return NextResponse.json(
      { success: false, message: 'Appwrite sync skipped (offline/unreachable)' },
      { status: 200 }
    );
  }
}
