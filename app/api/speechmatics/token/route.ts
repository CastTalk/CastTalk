import { NextResponse } from 'next/server';

/**
 * POST /api/speechmatics/token
 *
 * Exchanges the permanent Speechmatics API key for a short-lived JWT
 * that the browser can use to open a real-time WebSocket connection.
 *
 * The temporary key is scoped to real-time transcription only and
 * expires after the TTL (default 60 minutes).
 */
let cachedToken: { jwt: string; expiresAt: number } | null = null;

export async function POST() {
  const apiKey = process.env.SPEECHMATICS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'SPEECHMATICS_API_KEY is not configured' },
      { status: 500 }
    );
  }

  // Reuse cached token if it has at least 10 minutes remaining
  if (cachedToken && cachedToken.expiresAt > Date.now() + 10 * 60 * 1000) {
    return NextResponse.json({ jwt: cachedToken.jwt });
  }

  try {
    const res = await fetch(
      'https://mp.speechmatics.com/v1/api_keys?type=rt',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ ttl: 3600 }), // 1-hour expiry
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error('[Speechmatics token] API error:', res.status, text);
      return NextResponse.json(
        { error: 'Failed to generate temporary key', detail: text },
        { status: res.status }
      );
    }

    const data = await res.json();

    if (data.key_value) {
      cachedToken = {
        jwt: data.key_value,
        expiresAt: Date.now() + 3600 * 1000,
      };
    }

    // Response shape: { key_value: "...", ... }
    return NextResponse.json({ jwt: data.key_value });
  } catch (err) {
    console.error('[Speechmatics token] Network error:', err);
    return NextResponse.json(
      { error: 'Failed to reach Speechmatics API' },
      { status: 502 }
    );
  }
}
