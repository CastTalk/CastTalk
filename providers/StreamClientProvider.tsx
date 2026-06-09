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

    console.log('Initializing Stream with API key:', API_KEY?.substring(0, 5) + '...');
    
    const client = new StreamVideoClient({
      apiKey: API_KEY,
      user: {
        id: user?.id,
        name: user?.fullName || user?.firstName || user?.username || user?.id,
        image: user?.imageUrl,
      },
      tokenProvider,
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
