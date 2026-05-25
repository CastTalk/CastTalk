'use client';
import { Call, CallRecording } from '@stream-io/video-react-sdk';
import Loader from './Loader';
import { useGetCalls } from '@/hooks/useGetCalls';
import MeetingCard from './MeetingCard';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CaretLeft, CaretRight, ClockCounterClockwise, Calendar, FilmReel, Play } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

const CallList = ({ type }: { type: 'ended' | 'upcoming' | 'recordings' }) => {
  const router = useRouter();
  const { endedCalls, upcomingCalls, callRecordings, isLoading } =
    useGetCalls();
  const [recordings, setRecordings] = useState<CallRecording[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;

  const getCalls = () => {
    switch (type) {
      case 'ended':
        return endedCalls;
      case 'recordings':
        return recordings;
      case 'upcoming':
        return upcomingCalls;
      default:
        return [];
    }
  };

  const getNoCallsMessage = () => {
    switch (type) {
      case 'ended':
        return 'No previous sessions found';
      case 'upcoming':
        return 'No upcoming meetings scheduled';
      case 'recordings':
        return 'No recordings available';
      default:
        return '';
    }
  };

  useEffect(() => {
    const fetchRecordings = async () => {
      try {
        const callData = await Promise.all(
          callRecordings?.map((meeting) => meeting.queryRecordings()) ?? [],
        );

        const recordings = callData
          .filter((call) => call.recordings.length > 0)
          .flatMap((call) => call.recordings);

        setRecordings(recordings);
      } catch (error: any) {
        console.warn('Failed to fetch recordings:', error?.message || error);
        setRecordings([]);
      }
    };

    if (type === 'recordings' && callRecordings && callRecordings.length > 0) {
      const timer = setTimeout(() => {
        fetchRecordings();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [type, callRecordings]);

  if (isLoading) return <Loader />;

  const calls = getCalls();
  const noCallsMessage = getNoCallsMessage();
  
  // Pagination logic
  const totalPages = Math.ceil((calls?.length || 0) / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentCalls = calls?.slice(startIndex, endIndex);

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {currentCalls && currentCalls.length > 0 ? (
          currentCalls.map((meeting: Call | CallRecording) => (
            <MeetingCard
              key={(meeting as Call).id || (meeting as CallRecording).url}
              icon={
                type === 'ended'
                  ? ClockCounterClockwise
                  : type === 'upcoming'
                    ? Calendar
                    : FilmReel
              }
              title={
                (meeting as Call).state?.custom?.description ||
                (meeting as CallRecording).filename?.substring(0, 20) ||
                'No Description'
              }
              date={
                (meeting as Call).state?.startsAt?.toLocaleString() ||
                (meeting as CallRecording).start_time?.toLocaleString()
              }
              isPreviousMeeting={type === 'ended'}
              link={
                type === 'recordings'
                  ? (meeting as CallRecording).url
                  : `${process.env.NEXT_PUBLIC_BASE_URL}/meeting/${(meeting as Call).id}`
              }
              buttonIcon1={type === 'recordings' ? Play : undefined}
              buttonText={type === 'recordings' ? 'Play' : 'Start'}
              handleClick={
                type === 'recordings'
                  ? () => router.push(`${(meeting as CallRecording).url}`)
                  : () => router.push(`/meeting/${(meeting as Call).id}`)
              }
            />
          ))
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
            <div className="size-20 rounded-full bg-slate-50 flex-center mb-4">
              <ClockCounterClockwise size={40} weight="light" className="text-slate-300" />
            </div>
            <h1 className="text-xl font-bold text-slate-400">{noCallsMessage}</h1>
          </div>
        )}
      </div>
      
      {/* Pagination Controls */}
      {calls && calls.length > itemsPerPage && (
        <div className="flex items-center justify-end gap-4 mt-4">
          <button
            onClick={goToPreviousPage}
            disabled={currentPage === 1}
            className={cn(
              "size-12 rounded-2xl flex-center border transition-all duration-300 shadow-sm",
              currentPage === 1
                ? "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed"
                : "bg-white border-slate-100 text-slate-600 hover:border-primary/20 hover:text-primary"
            )}
          >
            <CaretLeft weight="bold" size={20} />
          </button>
          <span className="text-sm font-bold text-slate-500">
            Page <span className="text-slate-900">{currentPage}</span> of {totalPages}
          </span>
          <button
            onClick={goToNextPage}
            disabled={currentPage === totalPages}
            className={cn(
              "size-12 rounded-2xl flex-center border transition-all duration-300 shadow-sm",
              currentPage === totalPages
                ? "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed"
                : "bg-white border-slate-100 text-slate-600 hover:border-primary/20 hover:text-primary"
            )}
          >
            <CaretRight weight="bold" size={20} />
          </button>
        </div>
      )}
    </div>
  );
};

export default CallList;
