'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { StreamVideoClient, StreamVideo } from '@stream-io/video-react-sdk';

import { tokenProvider } from '@/actions/stream.actions';
import { useIdentity } from '@/providers/IdentityProvider';

const API_KEY = process.env.NEXT_PUBLIC_STREAM_API_KEY;

const getToken = async () => {
  try {
    const token = await tokenProvider();
    if (token) return token;
  } catch (err) {
    console.warn('[StreamClientProvider] Server action tokenProvider failed, trying API route fallback...', err);
  }

  const res = await fetch('/api/stream/token');
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to fetch stream token');
  }
  const data = await res.json();
  return data.token;
};

/**
 * Creates ONE Stream client per identity (member or session guest).
 *
 * - Depends on the user ID only, so Clerk refreshes don't rebuild the client.
 * - Never blocks the page: children render immediately (Home shows its content
 *   and the sign-in / guest prompt right away); pages that need Stream wait for
 *   the client themselves. Visitors who are neither member nor guest get no client.
 * - Guests are never synced to Appwrite (their data stays on the device).
 */
const StreamVideoProvider = ({ children }: { children: ReactNode }) => {
  const [videoClient, setVideoClient] = useState<StreamVideoClient>();
  const { user, isGuest } = useIdentity();
  const userId = user?.id;

  const profileRef = useRef({ name: '', image: '' });
  profileRef.current = {
    name: user?.fullName || user?.firstName || user?.username || user?.id || '',
    image: user?.imageUrl || '',
  };

  useEffect(() => {
    if (!userId) return;
    if (!API_KEY) {
      console.error('Stream API key is missing. Current value:', API_KEY);
      throw new Error('Stream API key is missing');
    }

    const client = new StreamVideoClient({
      apiKey: API_KEY,
      user: {
        id: userId,
        name: profileRef.current.name || userId,
        ...(profileRef.current.image ? { image: profileRef.current.image } : {}),
      },
      tokenProvider: getToken,
      options: {
        timeout: 30000,
        axiosRequestConfig: { timeout: 30000 },
      },
    });

    setVideoClient(client);

    // Mirror members into Appwrite Auth (identity read from the Clerk session on
    // the server) — once per user. Guests are never written to the database.
    if (!isGuest) {
      fetch('/api/auth/sync', { method: 'POST' }).catch((error) => {
        console.error('[StreamClientProvider] Failed to sync user to Appwrite:', error);
      });
    }

    return () => {
      setVideoClient(undefined);
      client.disconnectUser().catch((e) => console.warn('[StreamClientProvider] disconnect failed:', e));
    };
  }, [userId, isGuest]);

  if (!videoClient) return <>{children}</>;

  return <StreamVideo client={videoClient}>{children}</StreamVideo>;
};

export default StreamVideoProvider;
