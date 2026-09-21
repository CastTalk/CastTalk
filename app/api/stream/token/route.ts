import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { StreamClient } from '@stream-io/node-sdk';

export async function GET(req: Request) {
  try {
    let authUserId: string | null = null;
    try {
      const authData = auth();
      authUserId = authData.userId;
    } catch {}

    const { searchParams } = new URL(req.url);
    const queryUserId = searchParams.get('userId');

    const activeUserId = queryUserId || authUserId;

    if (!activeUserId) {
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

    const token = streamClient.createToken(activeUserId, expirationTime, issuedAt);

    return NextResponse.json({ token });
  } catch (error: any) {
    console.error('[API Stream Token Error]:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate token' }, { status: 500 });
  }
}
