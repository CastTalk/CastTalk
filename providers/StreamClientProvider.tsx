'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { StreamVideoClient, StreamVideo } from '@stream-io/video-react-sdk';
import { useUser } from '@clerk/nextjs';

import { tokenProvider } from '@/actions/stream.actions';
import Loader from '@/components/Loader';

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
 * Creates ONE Stream client per signed-in user.
 *
 * The effect depends on the user ID only. Clerk's `user` object gets a new identity
 * whenever Clerk refreshes its resources (focus, session refresh); depending on it
 * used to build a brand-new StreamVideoClient each time — re-rendering the whole
 * app, re-fetching the current call (a new, un-joined Call instance mid-meeting) and
 * leaking the old client's WebSocket, which was never disconnected.
 */
const StreamVideoProvider = ({ children }: { children: ReactNode }) => {
  const [videoClient, setVideoClient] = useState<StreamVideoClient>();
  const { user, isLoaded } = useUser();
  const userId = user?.id;

  // Latest profile fields, read when the client is created (not a dependency)
  const profileRef = useRef({ name: '', image: '' });
  profileRef.current = {
    name: user?.fullName || user?.firstName || user?.username || user?.id || '',
    image: user?.imageUrl || '',
  };

  useEffect(() => {
    if (!isLoaded || !userId) return;
    if (!API_KEY) {
      console.error('Stream API key is missing. Current value:', API_KEY);
      throw new Error('Stream API key is missing');
    }

    const client = new StreamVideoClient({
      apiKey: API_KEY,
      user: {
        id: userId,
        name: profileRef.current.name || userId,
        image: profileRef.current.image,
      },
      tokenProvider: getToken,
      options: {
        timeout: 30000,
        axiosRequestConfig: {
          timeout: 30000,
        },
      },
    });

    setVideoClient(client);

    // Sync Clerk authenticated user to Appwrite Auth (identity is read from the
    // Clerk session on the server) — once per user, not on every Clerk refresh
    fetch('/api/auth/sync', { method: 'POST' }).catch((error) => {
      console.error('[StreamClientProvider] Failed to sync user to Appwrite:', error);
    });

    return () => {
      setVideoClient(undefined);
      client.disconnectUser().catch((e) => console.warn('[StreamClientProvider] disconnect failed:', e));
    };
  }, [isLoaded, userId]);

  if (!videoClient) return <Loader />;

  return <StreamVideo client={videoClient}>{children}</StreamVideo>;
};

export default StreamVideoProvider;
