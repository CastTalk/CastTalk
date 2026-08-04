'use client';

import { useEffect, useState } from 'react';
import { Call, useStreamVideoClient } from '@stream-io/video-react-sdk';

export const useGetCallById = (id: string | string[]) => {
  const [call, setCall] = useState<Call>();
  const [isCallLoading, setIsCallLoading] = useState(true);

  const client = useStreamVideoClient();

  useEffect(() => {
    if (!client) return;
    
    let isCancelled = false;

    const loadCall = async () => {
      try {
        // Single ID check: use client.call to reference the call directly
        const callId = Array.isArray(id) ? id[0] : id;
        const callInstance = client.call('default', callId);
        
        // Fetch call details from stream backend
        await callInstance.get();

        if (!isCancelled) {
          setCall(callInstance);
          setIsCallLoading(false);
        }
      } catch (error) {
        console.error('[useGetCallById] Error:', error);
        if (!isCancelled) {
          setIsCallLoading(false);
        }
      }
    };

    loadCall();

    return () => {
      isCancelled = true;
    };
  }, [client, id]);

  return { call, isCallLoading };
};
