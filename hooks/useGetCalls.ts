import { useEffect, useState, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import { Call, useStreamVideoClient } from '@stream-io/video-react-sdk';

export const useGetCalls = () => {
  const { user } = useUser();
  const client = useStreamVideoClient();
  const [calls, setCalls] = useState<Call[]>();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadCalls = async () => {
      if (!client || !user?.id) return;
      
      setIsLoading(true);

      try {
        // 1. Query Stream SDK calls
        const { calls: streamCalls } = await client.queryCalls({
          sort: [{ field: 'starts_at', direction: -1 }],
          filter_conditions: {
            starts_at: { $exists: true },
            $or: [
              { created_by_user_id: user.id },
              { members: { $in: [user.id] } },
            ],
          },
        });

        // 2. Fetch Appwrite schedules for user to ensure joined participant meetings are included
        let extraCalls: Call[] = [];
        try {
          const scheduleRes = await fetch('/api/schedules');
          if (scheduleRes.ok) {
            const data = await scheduleRes.json();
            const schedules = data.schedules || [];
            const existingCallIds = new Set((streamCalls || []).map(c => c.id));
            
            const missingSchedules = schedules.filter(
              (s: any) => s.meetingId && !existingCallIds.has(s.meetingId)
            );

            if (missingSchedules.length > 0) {
              const fetched = await Promise.all(
                missingSchedules.map(async (s: any) => {
                  try {
                    const call = client.call('default', s.meetingId);
                    await call.get();
                    return call;
                  } catch (e) {
                    return null;
                  }
                })
              );
              extraCalls = fetched.filter((c): c is Call => c !== null);
            }
          }
        } catch (e) {
          console.error('[useGetCalls Appwrite sync error]:', e);
        }

        const map = new Map<string, Call>();
        (streamCalls || []).forEach(c => { if (c && c.id) map.set(c.id, c); });
        extraCalls.forEach(c => { if (c && c.id) map.set(c.id, c); });
        const combined = Array.from(map.values());

        // Sort descending by starts_at
        combined.sort((a, b) => {
          const aTime = a.state.startsAt ? new Date(a.state.startsAt).getTime() : 0;
          const bTime = b.state.startsAt ? new Date(b.state.startsAt).getTime() : 0;
          return bTime - aTime;
        });

        setCalls(combined);
      } catch (error) {
        console.error('[useGetCalls error]:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCalls();
  }, [client, user?.id]);

  const endedCalls = useMemo(() => {
    const now = new Date();
    return calls?.filter(({ state: { startsAt, endedAt } }: Call) => {
      return (startsAt && new Date(startsAt) < now) || !!endedAt;
    });
  }, [calls]);

  const upcomingCalls = useMemo(() => {
    const now = new Date();
    return calls?.filter(({ state: { startsAt, endedAt } }: Call) => {
      return startsAt && new Date(startsAt) > now && !endedAt;
    });
  }, [calls]);

  return { endedCalls, upcomingCalls, calls, callRecordings: calls, isLoading };
};