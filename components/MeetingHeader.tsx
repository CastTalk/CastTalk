'use client';
import { useCall } from '@stream-io/video-react-sdk';
import { useEffect, useState } from 'react';
import { VideoCamera, Timer } from '@phosphor-icons/react';

const MeetingHeader = () => {
  const call = useCall();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Use a local session timer instead of call.state.createdAt to avoid summing times across instant meetings
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const description = call?.state?.custom?.description || 'Instant Meeting';

  return (
    <div className="w-full flex items-center justify-between px-8 py-4 shrink-0 bg-transparent z-10 font-heading">
      {/* Left side: Title */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-4 bg-[#ecedef] border border-black/5 px-5 py-3 rounded-none shadow-[inset_0_1px_0_#ffffff,_0_1px_3px_rgba(0,0,0,0.02)]" style={{ borderWidth: '0.5px' }}>
          <div className="size-8 rounded-none bg-primary flex-center shadow-sm">
             <VideoCamera weight="bold" size={18} className="text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-[14px] font-bold text-slate-900 leading-none mb-0.5">
              {description}
            </h1>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CanCast Session</span>
          </div>
        </div>
      </div>

      {/* Right side: Timer */}
      <div className="flex items-center">
        <div className="flex items-center gap-4 bg-[#ecedef] border border-black/5 px-5 py-3 rounded-none shadow-[inset_0_1px_0_#ffffff,_0_1px_3px_rgba(0,0,0,0.02)]" style={{ borderWidth: '0.5px' }}>
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
            <span className="text-slate-900 text-[12px] font-bold uppercase tracking-widest">Live</span>
          </div>
          <div className="w-px h-4 bg-slate-200" />
          <div className="flex items-center gap-2 text-slate-600">
            <Timer weight="bold" size={16} className="text-primary" />
            <span className="text-[14px] font-bold tabular-nums">{formatTime(elapsedSeconds)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeetingHeader;
