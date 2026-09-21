'use client';

import { ReactNode, useEffect, useState } from 'react';
import { StreamVideoClient, StreamVideo } from '@stream-io/video-react-sdk';
import { useUser } from '@clerk/nextjs';

import { tokenProvider } from '@/actions/stream.actions';
import Loader from '@/components/Loader';

const API_KEY = process.env.NEXT_PUBLIC_STREAM_API_KEY;

const StreamVideoProvider = ({ children }: { children: ReactNode }) => {
  const [videoClient, setVideoClient] = useState<StreamVideoClient>();
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded || !user) return;
    if (!API_KEY) {
      console.error('Stream API key is missing. Current value:', API_KEY);
      throw new Error('Stream API key is missing');
    }
    
    const getToken = async () => {
      try {
        const token = await tokenProvider(user.id);
        if (token) return token;
      } catch (err) {
        console.warn('[StreamClientProvider] Server action tokenProvider failed, trying API route fallback...', err);
      }

      const res = await fetch(`/api/stream/token?userId=${encodeURIComponent(user.id)}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to fetch stream token');
      }
      const data = await res.json();
      return data.token;
    };

    const client = new StreamVideoClient({
      apiKey: API_KEY,
      user: {
        id: user?.id,
        name: user?.fullName || user?.firstName || user?.username || user?.id,
        image: user?.imageUrl,
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

    // Sync Clerk authenticated user to Appwrite Auth
    const syncUserToAppwrite = async () => {
      try {
        const email = user.emailAddresses?.[0]?.emailAddress || '';
        const name = user.fullName || user.firstName || '';
        
        await fetch('/api/auth/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
            email,
            name,
          }),
        });
      } catch (error) {
        console.error('[StreamClientProvider] Failed to sync user to Appwrite:', error);
      }
    };

    syncUserToAppwrite();
  }, [user, isLoaded]);

  if (!videoClient) return <Loader />;

  return <StreamVideo client={videoClient}>{children}</StreamVideo>;
};

export default StreamVideoProvider;
