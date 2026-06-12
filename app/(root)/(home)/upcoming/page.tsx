'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CaretLeft, CaretRight, Trash, Info, Copy, Globe, Lock, X, Clock, Timer } from '@phosphor-icons/react';
import { useGetCalls } from '@/hooks/useGetCalls';
import { Call } from '@stream-io/video-react-sdk';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import CastTalkModal from '@/components/CastTalkModal';

const HOUR_HEIGHT = 100;
const START_HOUR = 0;
const END_HOUR = 24;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR);
const TIME_COL_W = 56;

const COLOR_THEMES = [
  {
    bg: 'bg-gradient-to-b from-[#e6f4ea]/20 to-[#d0ebd6]/85',
    border: 'border-[#a8dab5]',
    text: 'text-[#137333]',
    subtext: 'text-[#137333]/75',
    iconBg: 'bg-[#137333]',
    iconText: 'text-[#ffffff]',
  },
  {
    bg: 'bg-gradient-to-b from-[#fef7e0]/20 to-[#faebd0]/85',
    border: 'border-[#fdd663]',
    text: 'text-[#b06000]',
    subtext: 'text-[#b06000]/75',
    iconBg: 'bg-[#b06000]',
    iconText: 'text-[#ffffff]',
  },
  {
    bg: 'bg-gradient-to-b from-[#e8f0fe]/20 to-[#d2e3fc]/85',
    border: 'border-[#aecbfa]',
    text: 'text-[#1a73e8]',
    subtext: 'text-[#1a73e8]/75',
    iconBg: 'bg-[#1a73e8]',
    iconText: 'text-[#ffffff]',
  },
  {
    bg: 'bg-gradient-to-b from-[#fce8e6]/20 to-[#fad2cf]/85',
    border: 'border-[#fad2cf]',
    text: 'text-[#c5221f]',
    subtext: 'text-[#c5221f]/75',
    iconBg: 'bg-[#c5221f]',
    iconText: 'text-[#ffffff]',
  },
  {
    bg: 'bg-gradient-to-b from-[#f3e8ff]/20 to-[#e8d5ffd8]/85',
    border: 'border-[#d8b4fe]',
    text: 'text-[#6b21a8]',
    subtext: 'text-[#6b21a8]/75',
    iconBg: 'bg-[#6b21a8]',
    iconText: 'text-[#ffffff]',
  },
];

function formatHour(h: number) {
  if (h === 0) return '';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDays(weekStart: Date) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function getCallsForDay(calls: Call[], date: Date) {
  const d = date.toDateString();
  return calls.filter((c) => {
    const s = c.state.startsAt;
    return s && new Date(s).toDateString() === d;
  });
}

function callTopPct(call: Call) {
  const s = new Date(call.state.startsAt!);
  return (s.getHours() + s.getMinutes() / 60 - START_HOUR) * HOUR_HEIGHT;
}

function callHeightPx(call: Call) {
  const s = call.state.startsAt!;
  const e = call.state.endedAt;
  if (e) {
    const mins = (new Date(e).getTime() - new Date(s).getTime()) / 60000;
    return Math.max((mins / 60) * HOUR_HEIGHT, HOUR_HEIGHT * 0.6);
  }
  // Use saved duration in minutes or default to 60 minutes
  const customDuration = Number(call.state.custom?.duration || 60);
  return Math.max((customDuration / 60) * HOUR_HEIGHT, HOUR_HEIGHT * 0.6);
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SchedulePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { calls, isLoading } = useGetCalls();
  const allCalls = (calls ?? []).filter((call) => !call.state.endedAt);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);

  useEffect(() => {
    if (calls && calls.length > 0) {
      console.log("DEBUG: All meetings found on calendar:", calls.map(c => ({
        id: c.id,
        title: c.state.custom?.title || c.state.custom?.description || 'Meeting',
        startsAt: c.state.startsAt,
        duration: c.state.custom?.duration,
      })));
    }
  }, [calls]);

  const today = new Date();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today));
  const [nowMinutes, setNowMinutes] = useState(today.getHours() * 60 + today.getMinutes());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => {
      const n = new Date();
      setNowMinutes(n.getHours() * 60 + n.getMinutes());
    }, 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      const top = (nowMinutes / 60 - START_HOUR) * HOUR_HEIGHT - 160;
      scrollRef.current.scrollTop = Math.max(0, top);
    }
  }, []);

  const weekDays = getWeekDays(weekStart);
  const nowTop = (nowMinutes / 60 - START_HOUR) * HOUR_HEIGHT;

  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };
  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };
  const goToday = () => setWeekStart(startOfWeek(new Date()));

  const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(weekStart);

  return (
    <div className="flex flex-col h-full font-geist select-none bg-[#FCFBFB]">

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 md:px-6 lg:px-8 py-4 border-b border-[#3E2723]/10 shrink-0">
        <div className="flex items-center gap-1">
          <button onClick={prevWeek} className="p-1.5 hover:bg-black/5 rounded transition-colors">
            <CaretLeft size={16} weight="bold" className="text-slate-600" />
          </button>
          <button onClick={nextWeek} className="p-1.5 hover:bg-black/5 rounded transition-colors">
            <CaretRight size={16} weight="bold" className="text-slate-600" />
          </button>
        </div>
        <button
          onClick={goToday}
          className="px-4 py-1.5 text-sm font-medium border border-[#c4cccc] hover:bg-black/5 transition-colors rounded"
        >
          Today
        </button>
        <span className="text-sm font-medium text-slate-700 ml-1">{monthLabel}</span>
      </div>

      {/* Calendar */}
      <div className="flex-1 overflow-hidden flex flex-col">

        {/* Day headers — sticky */}
        <div className="flex shrink-0 border-b border-[#3E2723]/10 overflow-y-hidden" style={{ paddingLeft: TIME_COL_W, scrollbarGutter: 'stable' }}>
          {weekDays.map((day) => {
            const isToday = day.toDateString() === today.toDateString();
            return (
              <div key={day.toISOString()} className={`flex-1 flex flex-col items-center py-3 border-l border-[#3E2723]/10 ${isToday ? 'bg-blue-50' : ''}`}>
                <span className={`text-xs font-medium uppercase tracking-wide ${isToday ? 'text-blue-600' : 'text-[#3E2723]/50'}`}>
                  {DAY_NAMES[day.getDay()]}
                </span>
                <span className={`text-2xl font-light leading-tight mt-0.5 ${isToday ? 'text-blue-600 font-medium' : 'text-[#3E2723]/80'}`}>
                  {day.getDate()}
                </span>
              </div>
            );
          })}
        </div>
 
        {/* Scrollable grid */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>
          <div className="flex" style={{ height: HOURS.length * HOUR_HEIGHT }}>

            {/* Time gutter */}
            <div className="shrink-0 relative bg-[#FCFBFB]" style={{ width: TIME_COL_W }}>
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="absolute w-full flex items-start justify-end pr-2"
                  style={{ top: (h - START_HOUR) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                >
                  <span className="text-[11px] text-[#3E2723]/50 -translate-y-2">
                    {formatHour(h)}
                  </span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDays.map((day) => {
              const isToday = day.toDateString() === today.toDateString();
              const dayCalls = getCallsForDay(allCalls, day);

              return (
                <div
                  key={day.toISOString()}
                  className={`flex-1 relative border-l border-[#3E2723]/10 ${isToday ? 'bg-blue-50/40' : 'bg-[#3E2723]/[0.01]'}`}
                >
                  {/* Hour lines */}
                  {HOURS.map((h) => (
                    <div
                      key={h}
                      className="absolute w-full border-t border-[#3E2723]/10"
                      style={{ top: (h - START_HOUR) * HOUR_HEIGHT }}
                    />
                  ))}

                  {/* Half-hour lines */}
                  {HOURS.map((h) => (
                    <div
                      key={`half-${h}`}
                      className="absolute w-full border-t border-[#3E2723]/5"
                      style={{ top: (h - START_HOUR) * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
                    />
                  ))}

                  {/* Current time line */}
                  {isToday && (
                    <div
                      className="absolute left-0 right-0 flex items-center z-20 pointer-events-none"
                      style={{ top: nowTop }}
                    >
                      <div className="size-2.5 rounded-full bg-red-500 -ml-1.5 shrink-0" />
                      <div className="flex-1 h-px bg-red-500" />
                    </div>
                  )}

                  {/* Meeting blocks */}
                  {dayCalls.map((call) => {
                    const top = callTopPct(call);
                    const height = callHeightPx(call);
                    const title = call.state.custom?.title || call.state.custom?.description || 'Meeting';
                    
                    const duration = Number(call.state.custom?.duration || 60);
                    const startsAtStr = call.state.startsAt!;
                    const start = new Date(startsAtStr);
                    const end = new Date(start.getTime() + duration * 60000);
                    
                    const isPast = !!call.state.endedAt || end < today;

                    // Consistently assign theme color based on call ID hash
                    const themeIndex = call.id 
                      ? (call.id.charCodeAt(0) + (call.id.charCodeAt(call.id.length - 1) || 0)) % COLOR_THEMES.length 
                      : 0;
                    const theme = COLOR_THEMES[themeIndex];

                    const displayHourMin = (d: Date) => {
                      let hours = d.getHours();
                      const minutes = d.getMinutes().toString().padStart(2, '0');
                      const ampm = hours >= 12 ? 'PM' : 'AM';
                      const displayHour = hours % 12 || 12;
                      return `${displayHour.toString().padStart(2, '0')}:${minutes} ${ampm}`;
                    };

                    const isSecure = call.state.custom?.meetingType === 'secure';

                    return (
                      <div
                        key={call.id}
                        className="absolute left-0 right-0 z-10 cursor-pointer overflow-hidden transition-all group"
                        style={{ 
                          top: top, 
                          height: height,
                        }}
                        onClick={() => setSelectedCall(call)}
                      >
                        <div 
                          className={cn(
                            "h-full border p-3 flex flex-col justify-between text-[13px] leading-snug transition-opacity hover:opacity-95 rounded-none relative overflow-hidden",
                            theme.bg,
                            theme.border,
                            theme.text,
                            isPast && "opacity-70 saturate-[0.8]"
                          )}
                        >
                          {/* Slashing Pattern Overlay for Past/Done Meetings */}
                          {isPast && (
                            <div 
                              className="absolute inset-0 pointer-events-none opacity-[0.14]"
                              style={{
                                backgroundImage: 'repeating-linear-gradient(135deg, currentColor, currentColor 1.5px, transparent 1.5px, transparent 8px)'
                              }}
                            />
                          )}
                          {/* Top row: Title and Badge Icon */}
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-bold text-[13px] truncate pr-4 leading-none mt-1">{title}</p>
                              {/* Round Badge Icon removed as requested */}
                            </div>
                            
                            {/* Description if present */}
                            {call.state.custom?.description && (
                              <p className="text-[10px] opacity-75 mt-0.5 font-medium truncate pr-4">
                                {call.state.custom.description}
                              </p>
                            )}
                          </div>

                          {/* Bottom Row: Time and Duration metadata with icons */}
                          <div className="flex items-center gap-3 mt-1.5 shrink-0">
                            <div className="flex items-center gap-1 opacity-80 text-[10px] font-bold">
                              <Clock size={11} weight="bold" />
                              <span>{displayHourMin(start)}</span>
                            </div>
                            <div className="flex items-center gap-1 opacity-80 text-[10px] font-bold">
                              <Timer size={11} weight="bold" />
                              <span>{duration} min</span>
                            </div>
                          </div>

                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const confirmDelete = confirm("Are you sure you want to cancel and delete this scheduled meeting?");
                              if (confirmDelete) {
                                try {
                                  await call.endCall();
                                  // Delete from Appwrite DB schedules
                                  await fetch(`/api/schedules?meetingId=${call.id}`, {
                                    method: 'DELETE'
                                  }).catch(err => console.error('[Error deleting schedule from DB]:', err));
                                  
                                  toast({ title: "Meeting cancelled successfully" });
                                  window.location.reload();
                                } catch (err) {
                                  console.error(err);
                                  toast({ title: "Failed to cancel meeting" });
                                }
                              }
                            }}
                            className="absolute top-2.5 right-2.5 p-1 rounded-md hover:bg-black/5 opacity-0 group-hover:opacity-70 hover:!opacity-100 transition-all active:scale-95 text-current"
                            title="Cancel Meeting"
                          >
                            <Trash size={15} weight="bold" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selectedCall && (() => {
        const title = selectedCall.state.custom?.title || selectedCall.state.custom?.description || 'Meeting';
        const duration = Number(selectedCall.state.custom?.duration || 60);
        const startsAt = new Date(selectedCall.state.startsAt!);
        const end = new Date(startsAt.getTime() + duration * 60000);
        const isFuture = startsAt > new Date();
        const meetingType = selectedCall.state.custom?.meetingType || 'general';
        const meetingUrl = `${window.location.origin}/meeting/${selectedCall.id}`;

        const formatTime = (d: Date) => {
          let hours = d.getHours();
          const minutes = d.getMinutes().toString().padStart(2, '0');
          const ampm = hours >= 12 ? 'PM' : 'AM';
          const displayHour = hours % 12 || 12;
          return `${displayHour.toString().padStart(2, '0')}:${minutes} ${ampm}`;
        };

        const dateString = startsAt.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

        return (
          <CastTalkModal 
            isOpen={!!selectedCall} 
            onClose={() => setSelectedCall(null)}
            maxWidth="max-w-[480px]"
          >
            <div className="space-y-6 py-3">
              {/* Header: Title and Badge in same row */}
              <div>
                <div className="flex items-start justify-between gap-4">
                  <h2 
                    className="text-[22px] font-bold text-[#111827] leading-snug"
                    style={{ marginBottom: '3px' }}
                  >
                    {title}
                  </h2>
                  <div className="shrink-0 mt-1">
                    {meetingType === 'secure' ? (
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-amber-700">
                        <Lock size={12} weight="fill" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Secure</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-700">
                        <Globe size={12} weight="fill" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">General</span>
                      </div>
                    )}
                  </div>
                </div>
                {/* Date and duration on same row with bullet separator (less gap mt-0.5) */}
                <p 
                  className="text-[13px] text-slate-500 font-medium mt-0.5 flex items-center gap-2"
                  style={{ marginBottom: '5px' }}
                >
                  <span>{dateString}</span>
                  <span className="size-1 rounded-full bg-slate-300" />
                  <span>{duration} mins</span>
                </p>
              </div>

              {/* Notice */}
              {isFuture ? (
                <div className="p-3.5 rounded-xl border border-[rgba(62,39,35,0.15)] bg-[#3E2723]/[0.02] flex items-start gap-3">
                  <div className="size-8 rounded-lg bg-[#3E2723]/5 flex items-center justify-center text-[#3E2723] shrink-0 border border-[rgba(62,39,35,0.1)]">
                    <Info size={16} weight="bold" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-bold text-[#3E2723] mb-0.5">
                      Not started yet
                    </p>
                    <p className="text-[12px] text-slate-500 font-normal leading-relaxed">
                      This meeting is scheduled for {formatTime(startsAt)}. You will be able to enter once the host opens the lobby.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl border border-green-200 bg-green-50/50 flex items-start gap-3">
                  <div className="size-8 rounded-lg bg-green-100 flex items-center justify-center text-green-700 shrink-0">
                    <Info size={16} weight="bold" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-bold text-green-800 mb-0.5">
                      Meeting Ongoing / Ready
                    </p>
                    <p className="text-[12px] text-slate-600 font-normal leading-relaxed">
                      This meeting is ongoing! Click the btn below to join the room.
                    </p>
                  </div>
                </div>
              )}

              {/* Copy Meeting Link */}
              <div>
                <label className="text-[13px] font-bold text-[#374151] mb-1.5 block">
                  Meeting Link
                </label>
                <div className="flex items-center gap-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3.5 py-2.5">
                  <span className="flex-1 text-[13px] text-slate-600 truncate font-medium">{meetingUrl}</span>
                  <div
                    onClick={async () => { 
                      await navigator.clipboard.writeText(meetingUrl); 
                      toast({ title: 'Link copied!' }); 
                    }}
                    className="cursor-pointer text-slate-500 hover:text-black transition-colors shrink-0 p-1.5 rounded-lg hover:bg-black/5 flex items-center justify-center active:scale-95 border border-transparent hover:border-slate-200"
                    title="Copy Link"
                  >
                    <Copy size={16} weight="bold" />
                  </div>
                </div>
              </div>

              {/* Bottom aligned button actions with top-border divider */}
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-[#E5E7EB]">
                <div>
                  <button
                    onClick={() => setSelectedCall(null)}
                    className="px-5 py-2.5 rounded-xl text-[14px] font-bold hover:bg-[#F9FAFB] transition-colors text-[#374151] border border-[#E5E7EB] hover:border-[#D1D5DB] shadow-sm bg-white"
                  >
                    Close
                  </button>
                </div>
                
                {!isFuture && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setSelectedCall(null);
                        router.push(`/meeting/${selectedCall.id}`);
                      }}
                      className="px-6 py-2.5 rounded-xl text-[14px] font-bold hover:opacity-90 transition-opacity text-white shadow-sm"
                      style={{ backgroundColor: '#3E2723' }}
                    >
                      Join Meeting
                    </button>
                  </div>
                )}
              </div>
            </div>
          </CastTalkModal>
        );
      })()}
    </div>
  );
}
