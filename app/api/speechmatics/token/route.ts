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
export async function POST() {
  const apiKey = process.env.SPEECHMATICS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'SPEECHMATICS_API_KEY is not configured' },
      { status: 500 }
    );
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
