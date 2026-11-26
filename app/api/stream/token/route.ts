import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { StreamClient } from '@stream-io/node-sdk';

// Fallback for the tokenProvider server action. The user ID comes only from the
// Clerk session; any ?userId= query parameter is ignored on purpose.
export async function GET() {
  try {
    const { userId } = auth();

    if (!userId) {
      return NextResponse.json({ error: 'User is not authenticated' }, { status: 401 });
    }

    const STREAM_API_KEY = process.env.NEXT_PUBLIC_STREAM_API_KEY;
    const STREAM_API_SECRET = process.env.STREAM_SECRET_KEY;

    if (!STREAM_API_KEY || !STREAM_API_SECRET) {
      console.error('[API Stream Token] Missing Stream API Key or Secret');
      return NextResponse.json({ error: 'Stream credentials not configured' }, { status: 500 });
    }

    const streamClient = new StreamClient(STREAM_API_KEY, STREAM_API_SECRET);
    const expirationTime = Math.floor(Date.now() / 1000) + 24 * 3600;
    const issuedAt = Math.floor(Date.now() / 1000) - 60;

    const token = streamClient.createToken(userId, expirationTime, issuedAt);

    return NextResponse.json({ token });
  } catch (error: any) {
    console.error('[API Stream Token Error]:', error);
    return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
  }
}
