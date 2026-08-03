'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CaretLeft, CaretRight, Trash, Info, Copy, Globe, Lock, X, Clock, Timer, MagnifyingGlass, Sliders } from '@phosphor-icons/react';
import { useGetCalls } from '@/hooks/useGetCalls';
import { Call, useStreamVideoClient } from '@stream-io/video-react-sdk';
import { useUser } from '@clerk/nextjs';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import CastTalkModal from '@/components/CastTalkModal';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';

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

function groupOverlappingCalls(calls: Call[]): Call[][] {
  const sorted = [...calls].sort((a, b) => {
    return new Date(a.state.startsAt!).getTime() - new Date(b.state.startsAt!).getTime();
  });

  const groups: Call[][] = [];
  
  for (const call of sorted) {
    let added = false;
    for (const group of groups) {
      const overlaps = group.some(gCall => {
        const s1 = new Date(gCall.state.startsAt!).getTime();
        const d1 = Number(gCall.state.custom?.duration || 60) * 60000;
        const e1 = s1 + d1;

        const s2 = new Date(call.state.startsAt!).getTime();
        const d2 = Number(call.state.custom?.duration || 60) * 60000;
        const e2 = s2 + d2;

        const intervalsOverlap = (s1 < e2 && s2 < e1);
        const startClose = Math.abs(s1 - s2) < 15 * 60000;
        
        return intervalsOverlap || startClose;
      });

      if (overlaps) {
        group.push(call);
        added = true;
        break;
      }
    }
    if (!added) {
      groups.push([call]);
    }
  }

  return groups;
}

export default function SchedulePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { calls, isLoading } = useGetCalls();
  const [localCalls, setLocalCalls] = useState<Call[]>([]);

  const client = useStreamVideoClient();
  const { user } = useUser();

  const [meetingMode, setMeetingMode] = useState<'later' | null>(null);
  const [step, setStep] = useState(1);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formDate, setFormDate] = useState<Date>(new Date());
  const [formDuration, setFormDuration] = useState(60);
  const [meetingType, setMeetingType] = useState<'general' | 'secure'>('general');
  const [previewId, setPreviewId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [meetingLink, setMeetingLink] = useState<string | null>(null);

  const handleCellClick = (day: Date, hour: number, minute: number) => {
    const clickedDate = new Date(day);
    clickedDate.setHours(hour, minute, 0, 0);

    if (clickedDate < new Date()) {
      toast({
        title: "Cannot schedule meeting in the past",
        description: "Please select a future time slot.",
        variant: "destructive",
      });
      return;
    }

    setFormDate(clickedDate);
    setMeetingType('general');
    setFormTitle('');
    setFormDesc('');
    setFormDuration(60);
    setPreviewId(crypto.randomUUID());
    setStep(1);
    setMeetingMode('later');
  };

  const handleSubmit = async (bypassConflict = false) => {
    if (!client || !user) return;
    try {
      setIsCreating(true);

      if (!bypassConflict) {
        const proposedStart = formDate;
        const proposedEnd = new Date(formDate.getTime() + formDuration * 60000);

        // Fetch existing calls
        const { calls: fetchedCalls } = await client.queryCalls({
          sort: [{ field: 'starts_at', direction: -1 }],
          filter_conditions: {
            starts_at: { $exists: true },
            $or: [
              { created_by_user_id: user.id },
              { members: { $in: [user.id] } },
            ],
          },
        });

        const BUFFER = 30 * 60000;
        let conflictDetected = false;

        const now = new Date();
        for (const call of (fetchedCalls || [])) {
          const startsAtStr = call.state.startsAt;
          if (!startsAtStr) continue;

          const sExisting = new Date(startsAtStr);
          const dExisting = Number(call.state.custom?.duration || 60);
          const eExisting = new Date(sExisting.getTime() + dExisting * 60000);

          if (eExisting < now) continue;
          if (call.state.endedAt) continue;

          const noOverlap = (proposedEnd.getTime() + BUFFER <= sExisting.getTime()) ||
            (proposedStart.getTime() >= eExisting.getTime() + BUFFER);

          if (!noOverlap) {
            conflictDetected = true;
            break;
          }
        }

        if (conflictDetected) {
          setIsCreating(false);
          setStep(3);
          return;
        }
      }

      const call = client.call('default', previewId);
      if (!call) throw new Error('Failed to create meeting');
      const startsAt = formDate.toISOString();
      await call.getOrCreate({
        data: {
          starts_at: startsAt,
          custom: {
            title: formTitle || 'Untitled Meeting',
            description: formDesc,
            meetingType,
            duration: formDuration,
          },
        },
      });

      await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingId: call.id,
          title: formTitle || 'Scheduled Meeting',
          description: formDesc || '',
          startsAt,
          duration: formDuration,
          meetingType
        })
      }).catch(err => console.error('[Error syncing manual schedule to Appwrite DB]:', err));

      setLocalCalls(prev => [call, ...prev]);
      setMeetingMode(null);
      setStep(1);
      setMeetingLink(`${window.location.origin}/meeting/${call.id}`);
      toast({ title: 'Meeting scheduled successfully' });
    } catch (error) {
      console.error(error);
      toast({ title: 'Failed to create meeting' });
    } finally {
      setIsCreating(false);
    }
  };

  useEffect(() => {
    if (calls) {
      setLocalCalls(calls);
    }
  }, [calls]);

  const allCalls = (localCalls ?? []).filter((call) => !call.state.endedAt);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<Call[] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [callToDelete, setCallToDelete] = useState<Call | null>(null);

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

  const scrollToCurrentTime = (smooth = true) => {
    if (scrollRef.current) {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const top = (currentMinutes / 60 - START_HOUR) * HOUR_HEIGHT - 160;
      scrollRef.current.scrollTo({
        top: Math.max(0, top),
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  };

  useEffect(() => {
    scrollToCurrentTime(false);
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
  const goToday = () => {
    setWeekStart(startOfWeek(new Date()));
    setTimeout(() => {
      scrollToCurrentTime(true);
    }, 50);
  };

  const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(weekStart);

  return (
    <div className="flex flex-col h-full font-geist select-none bg-[#FCFBFB]">
      <style>{`
        @keyframes rotate-dash {
          to {
            stroke-dashoffset: -12;
          }
        }
        .animate-dash {
          stroke-dasharray: 6 6;
          stroke-linecap: round;
        }
        .group:hover .animate-dash {
          animation: rotate-dash 1.8s linear infinite;
        }
      `}</style>

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

                  {/* Clickable slot overlays (half-hour increments) */}
                  {HOURS.map((h) => {
                    const now = new Date();
                    const isTopPast = new Date(day.getTime()).setHours(h, 0, 0, 0) < now.getTime();
                    const isBottomPast = new Date(day.getTime()).setHours(h, 30, 0, 0) < now.getTime();

                    return (
                      <div key={`slot-container-${h}`}>
                        {/* Top half hour */}
                        <div
                          className={cn(
                            "absolute left-0 right-0 z-0 transition-all",
                            isTopPast
                              ? "pointer-events-none"
                              : "cursor-pointer group hover:bg-blue-50/10"
                          )}
                          style={{
                            top: (h - START_HOUR) * HOUR_HEIGHT,
                            height: HOUR_HEIGHT / 2,
                          }}
                          onClick={() => !isTopPast && handleCellClick(day, h, 0)}
                        >
                          {!isTopPast && (
                            <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" fill="none">
                              <rect
                                x="1.5"
                                y="1.5"
                                style={{ width: 'calc(100% - 3px)', height: 'calc(100% - 3px)' }}
                                rx="4"
                                ry="4"
                                stroke="#3b82f6"
                                strokeWidth="1.5"
                                className="animate-dash"
                              />
                            </svg>
                          )}
                        </div>
                        {/* Bottom half hour */}
                        <div
                          className={cn(
                            "absolute left-0 right-0 z-0 transition-all",
                            isBottomPast
                              ? "pointer-events-none"
                              : "cursor-pointer group hover:bg-blue-50/10"
                          )}
                          style={{
                            top: (h - START_HOUR) * HOUR_HEIGHT + HOUR_HEIGHT / 2,
                            height: HOUR_HEIGHT / 2,
                          }}
                          onClick={() => !isBottomPast && handleCellClick(day, h, 30)}
                        >
                          {!isBottomPast && (
                            <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" fill="none">
                              <rect
                                x="1.5"
                                y="1.5"
                                style={{ width: 'calc(100% - 3px)', height: 'calc(100% - 3px)' }}
                                rx="4"
                                ry="4"
                                stroke="#3b82f6"
                                strokeWidth="1.5"
                                className="animate-dash"
                              />
                            </svg>
                          )}
                        </div>
                      </div>
                    );
                  })}

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
                  {groupOverlappingCalls(dayCalls).map((group) => {
                    const displayHourMin = (d: Date) => {
                      let hours = d.getHours();
                      const minutes = d.getMinutes().toString().padStart(2, '0');
                      const ampm = hours >= 12 ? 'PM' : 'AM';
                      const displayHour = hours % 12 || 12;
                      return `${displayHour.toString().padStart(2, '0')}:${minutes} ${ampm}`;
                    };

                    if (group.length === 1) {
                      const call = group[0];
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
                                 <p className="font-medium text-[13px] truncate pr-4 leading-none mt-1">{title}</p>
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
                               <div className="flex items-center gap-1 opacity-80 text-[10px] font-medium">
                                 <Clock size={11} weight="bold" />
                                 <span>{displayHourMin(start)}</span>
                               </div>
                               <div className="flex items-center gap-1 opacity-80 text-[10px] font-medium">
                                 <Timer size={11} weight="bold" />
                                 <span>{duration} min</span>
                               </div>
                             </div>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setCallToDelete(call);
                              }}
                              className="absolute top-2.5 right-2.5 p-1 rounded-md hover:bg-black/5 opacity-0 group-hover:opacity-70 hover:!opacity-100 transition-all active:scale-95 text-current"
                              title="Cancel Meeting"
                            >
                              <Trash size={15} weight="bold" />
                            </button>
                          </div>
                        </div>
                      );
                    } else {
                      // Compact placeholder for overlapping meetings
                      const top = Math.min(...group.map(c => callTopPct(c)));
                      const bottom = Math.max(...group.map(c => callTopPct(c) + callHeightPx(c)));
                      const height = bottom - top;

                      const earliestCall = [...group].sort((a, b) => new Date(a.state.startsAt!).getTime() - new Date(b.state.startsAt!).getTime())[0];
                      const earliestTime = new Date(earliestCall.state.startsAt!);

                      return (
                        <div
                          key={`cluster-${group.map(c => c.id).join('-')}`}
                          className="absolute left-0 right-0 z-10 cursor-pointer overflow-hidden transition-all group"
                          style={{
                            top: top,
                            height: height,
                          }}
                          onClick={() => setSelectedCluster(group)}
                        >
                          <div
                            className="h-full border border-amber-300/80 p-3 flex flex-col justify-start items-start rounded-none relative overflow-hidden bg-gradient-to-b from-amber-50/90 to-amber-100/90 text-amber-900 shadow-sm"
                          >
                            {/* Slashing pattern background to indicate overlapping/stacked events */}
                            <div
                              className="absolute inset-0 pointer-events-none opacity-[0.08]"
                              style={{
                                backgroundImage: 'repeating-linear-gradient(135deg, currentColor, currentColor 1.5px, transparent 1.5px, transparent 8px)'
                              }}
                            />
                            <div className="w-full text-left">
                              <h3 className="font-medium text-[13px] text-[#3E2723] leading-tight mb-0">
                                {group.length} Overlapping Meetings
                              </h3>
                              <p className="text-[11px] text-[#3E2723]/75 mt-0.5 leading-snug">
                                Multiple meetings scheduled at this time.
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    }
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
                    className="text-[22px] font-semibold text-[#111827] leading-snug"
                    style={{ marginBottom: '3px' }}
                  >
                    {title}
                  </h2>
                  <div className="shrink-0 mt-1">
                    {meetingType === 'secure' ? (
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-amber-700">
                        <Lock size={12} weight="fill" />
                        <span className="text-[10px] font-medium uppercase tracking-wider">Secure</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-700">
                        <Globe size={12} weight="fill" />
                        <span className="text-[10px] font-medium uppercase tracking-wider">General</span>
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
                     <p className="text-[13px] font-medium text-[#3E2723] mb-0.5">
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
                     <p className="text-[13px] font-medium text-green-800 mb-0.5">
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
                 <label className="text-[13px] font-semibold text-[#374151] mb-1.5 block">
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

      {callToDelete && (
        <CastTalkModal
          isOpen={!!callToDelete}
          onClose={() => setCallToDelete(null)}
          maxWidth="max-w-[420px]"
        >
          <div className="flex flex-col font-geist">
            <h2 className="text-[20px] font-medium text-[#111827] leading-none mb-2.5">
              Cancel Meeting
            </h2>
            <p className="text-[14px] text-slate-500 leading-relaxed mb-6">
              Are you sure you want to cancel and delete this scheduled meeting? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-4 border-t border-[#E5E7EB]">
              <button
                type="button"
                onClick={() => setCallToDelete(null)}
                className="px-5 py-2.5 rounded-xl text-[14px] font-bold hover:bg-[#F9FAFB] transition-colors text-[#374151] border border-[#E5E7EB] hover:border-[#D1D5DB] shadow-sm bg-white"
              >
                Close
              </button>
              <button
                type="button"
                onClick={async () => {
                  const targetCall = callToDelete;
                  if (!targetCall) return;

                  // Save backups for rollback
                  const previousCalls = [...localCalls];
                  const previousCluster = selectedCluster;
                  const previousSelectedCall = selectedCall;

                  // Optimistically update UI states
                  setLocalCalls((prev) => prev.filter((c) => c.id !== targetCall.id));
                  setSelectedCluster((prev) => {
                    if (!prev) return null;
                    const filtered = prev.filter((c) => c.id !== targetCall.id);
                    return filtered.length > 0 ? filtered : null;
                  });
                  setSelectedCall((prev) => (prev && prev.id === targetCall.id ? null : prev));
                  setCallToDelete(null);

                  try {
                    await targetCall.endCall();
                    
                    // Delete from Appwrite DB schedules
                    const response = await fetch(`/api/schedules?meetingId=${targetCall.id}`, {
                      method: 'DELETE'
                    });

                    if (!response.ok) {
                      throw new Error('Failed to delete schedule from database');
                    }

                    toast({ title: "Meeting cancelled successfully" });
                  } catch (err) {
                    console.error('[Error cancelling meeting]:', err);
                    
                    // Rollback to previous states on failure
                    setLocalCalls(previousCalls);
                    setSelectedCluster(previousCluster);
                    setSelectedCall(previousSelectedCall);
                    
                    toast({ 
                      title: "Failed to cancel meeting",
                      description: "Please check your network and try again."
                    });
                  }
                }}
                className="bg-red-600 hover:bg-red-700 text-white text-[14px] font-bold px-6 py-2.5 rounded-xl transition-all shadow-sm active:scale-[0.98]"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </CastTalkModal>
      )}

      {selectedCluster && (
        <CastTalkModal
          isOpen={!!selectedCluster}
          onClose={() => { setSelectedCluster(null); setSearchQuery(''); }}
          maxWidth="max-w-[480px]"
          className="!bg-white border-2 !border-[rgba(62,39,35,0.4)] shadow-2xl !text-slate-900"
          contentClassName="!p-0 !mt-0 flex flex-col"
        >
          <div className="flex flex-col font-geist">
            {/* Top Div: Search bar and separator */}
            <div className="px-5 pt-3.5 pb-3 border-b border-[#3E2723]/15">
              <div className="flex items-center gap-3">
                <MagnifyingGlass size={18} className="text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search meetings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent border-none text-slate-900 text-sm focus:outline-none placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Bottom Div: Results list & footer close button */}
            <div className="p-5 pt-4">
              {/* Results Title */}
              <div className="text-[12px] font-normal text-slate-400 mb-2.5">
                Meetings ({selectedCluster.filter(c => {
                  const title = (c.state.custom?.title || '').toLowerCase();
                  const desc = (c.state.custom?.description || '').toLowerCase();
                  const q = searchQuery.toLowerCase();
                  return title.includes(q) || desc.includes(q);
                }).length})
              </div>

              {/* List scroll area - Hide scrollbar but keep scrollable */}
              <div 
                className="space-y-2 max-h-[300px] overflow-y-auto no-scrollbar mb-6"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                <style>{`
                  .no-scrollbar::-webkit-scrollbar {
                    display: none;
                  }
                `}</style>
                {selectedCluster
                  .filter(call => {
                    const title = (call.state.custom?.title || '').toLowerCase();
                    const desc = (call.state.custom?.description || '').toLowerCase();
                    const q = searchQuery.toLowerCase();
                    return title.includes(q) || desc.includes(q);
                  })
                  .map((call) => {
                    const title = call.state.custom?.title || call.state.custom?.description || 'Meeting';
                    const duration = Number(call.state.custom?.duration || 60);
                    const startsAt = new Date(call.state.startsAt!);
                    const isSecure = call.state.custom?.meetingType === 'secure';

                    const formatTime = (d: Date) => {
                      let hours = d.getHours();
                      const minutes = d.getMinutes().toString().padStart(2, '0');
                      const ampm = hours >= 12 ? 'PM' : 'AM';
                      const displayHour = hours % 12 || 12;
                      return `${displayHour}:${minutes} ${ampm}`;
                    };

                    return (
                      <div 
                        key={call.id} 
                        className="flex items-center justify-between py-0.5 px-3 rounded-xl hover:bg-[#3E2723]/5 cursor-pointer transition-colors relative group/item"
                        onClick={() => {
                          setSelectedCall(call);
                          setSelectedCluster(null);
                          setSearchQuery('');
                        }}
                      >
                        {/* Left: Round icon/avatar indicating type */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="h-10 w-10 rounded-lg bg-slate-50 border border-[#3E2723]/10 flex items-center justify-center shrink-0">
                            {isSecure ? <Lock size={18} weight="fill" className="text-amber-700" /> : <Globe size={18} weight="fill" className="text-emerald-700" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-medium text-[13px] text-slate-800 leading-snug group-hover/item:text-[#3E2723] transition-colors truncate mb-0.5">
                              {title}
                            </h3>
                            <p className="text-[10px] text-slate-400 font-normal mt-0.5 flex items-center gap-1.5">
                              <span>{formatTime(startsAt)}</span>
                              <span className="size-1 rounded-full bg-slate-350" />
                              <span>{duration} mins</span>
                            </p>
                          </div>
                        </div>

                        {/* Right actions: Delete button */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCallToDelete(call);
                              setSelectedCluster(null);
                              setSearchQuery('');
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-650 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover/item:opacity-100"
                            title="Cancel Meeting"
                          >
                            <Trash size={18} weight="bold" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Footer with a styled Close button matching delete modal close button */}
              <div className="flex justify-end pt-3.5 border-t border-[#3E2723]/15">
                <button
                  type="button"
                  onClick={() => { setSelectedCluster(null); setSearchQuery(''); }}
                  className="px-5 py-2.5 rounded-xl text-[14px] font-bold hover:bg-[#F9FAFB] transition-colors text-[#374151] border border-[#E5E7EB] hover:border-[#D1D5DB] shadow-sm bg-white"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </CastTalkModal>
      )}

      {meetingMode && step <= 2 && (
        <CastTalkModal isOpen={!!meetingMode && step <= 2} onClose={() => { setMeetingMode(null); setStep(1); }}>
          {step <= 2 && (
            <>
              {/* Step indicator */}
              <div className="flex items-center gap-2 mb-2">
                <div className={cn("flex-1 h-1.5 rounded-full", step >= 1 ? "bg-[#3E2723]" : "bg-slate-200")} />
                <div className={cn("flex-1 h-1.5 rounded-full", step >= 2 ? "bg-[#3E2723]" : "bg-slate-200")} />
              </div>
              <div className="flex items-center gap-2 mb-6">
                <div className={cn("flex-1 text-[12px] font-medium text-left", step >= 1 ? "text-[#3E2723]" : "text-slate-400")}>
                  Session
                </div>
                <div className={cn("flex-1 text-[12px] font-medium text-left", step >= 2 ? "text-[#3E2723]" : "text-slate-400")}>
                  Details
                </div>
              </div>
            </>
          )}

          <div className="relative w-full transition-all duration-300 overflow-hidden h-[300px]">
            {/* Step 1: Session Choice */}
            <div className={cn(
              "absolute top-0 left-0 w-full transition-all duration-400 ease-in-out",
              step === 1 ? "translate-x-0 opacity-100" : "-translate-x-8 opacity-0 pointer-events-none"
            )}>
              <div className="space-y-6">
                <div>
                  <h2 className="text-[22px] font-medium text-[#111827] leading-none mb-1.5">
                    Select Meeting Type
                  </h2>
                  <p className="text-[14px] text-[#6B7280]" style={{ marginBottom: '10px' }}>
                    Select the type of meeting you want to create.
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <label
                    className={cn(
                      "flex items-start gap-3.5 p-3 rounded-xl cursor-pointer transition-all border border-transparent",
                      meetingType === 'general' ? "bg-emerald-50 border-emerald-200" : "hover:bg-slate-50"
                    )}
                    onClick={() => setMeetingType('general')}
                  >
                    <div className="mt-0.5">
                      <div className={cn(
                        "w-5 h-5 rounded-full border-[2px] flex items-center justify-center transition-colors",
                        meetingType === 'general' ? "border-emerald-600" : "border-slate-300"
                      )}>
                        {meetingType === 'general' && <div className="w-2.5 h-2.5 rounded-full bg-emerald-600" />}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Globe weight="fill" className={cn("w-4 h-4", meetingType === 'general' ? "text-emerald-600" : "text-slate-500")} />
                        <span className="text-[15px] font-medium text-[#111827]">General</span>
                      </div>
                      <p className="text-[13px] text-[#6B7280] leading-snug">
                        Open to anyone with the link — session data is stored and accessible after the meeting.
                      </p>
                    </div>
                  </label>

                  <label
                    className={cn(
                      "flex items-start gap-3.5 p-3 rounded-xl cursor-pointer transition-all border border-transparent",
                      meetingType === 'secure' ? "bg-amber-50 border-amber-200" : "hover:bg-slate-50"
                    )}
                    onClick={() => setMeetingType('secure')}
                  >
                    <div className="mt-0.5">
                      <div className={cn(
                        "w-5 h-5 rounded-full border-[2px] flex items-center justify-center transition-colors",
                        meetingType === 'secure' ? "border-amber-600" : "border-slate-300"
                      )}>
                        {meetingType === 'secure' && <div className="w-2.5 h-2.5 rounded-full bg-amber-600" />}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Lock weight="fill" className={cn("w-4 h-4", meetingType === 'secure' ? "text-amber-600" : "text-slate-500")} />
                        <span className="text-[15px] font-medium text-[#111827]">Secure</span>
                      </div>
                      <p className="text-[13px] text-[#6B7280] leading-snug">
                        Private and invite-only — all session data is permanently removed once the meeting ends.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Step 2: Details Form */}
            <div className={cn(
              "absolute top-0 left-0 w-full transition-all duration-400 ease-in-out",
              step === 2
                ? "translate-x-0 opacity-100"
                : (step === 1 ? "translate-x-8 opacity-0 pointer-events-none" : "-translate-x-8 opacity-0 pointer-events-none")
            )}>
              <div className="space-y-4">
                <div>
                  <h2 className="text-[22px] font-medium text-[#111827] leading-none mb-1.5">
                    {"What's your meeting about?"}
                  </h2>
                  <p className="text-[14px] text-[#6B7280]" style={{ marginBottom: '20px' }}>
                    Fill out the details of your meeting.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">
                      Event Topic <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="What's your meeting?"
                      className="w-full px-3 py-2 rounded-lg text-[14px] outline-none transition-colors"
                      style={{
                        backgroundColor: '#F9FAFB',
                        border: '1px solid #E5E7EB',
                        color: '#111827'
                      }}
                    />
                  </div>

                  <div className="flex flex-col w-full">
                    <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">
                      Start Date <span className="text-red-500">*</span>
                    </label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            "w-full px-3 py-2 rounded-lg text-[14px] outline-none flex items-center justify-between transition-colors",
                            !formDate ? "text-[#9CA3AF]" : "text-[#111827]"
                          )}
                          style={{
                            backgroundColor: '#F9FAFB',
                            backgroundImage: 'none',
                            border: '1px solid #E5E7EB'
                          }}
                        >
                          {formDate ? format(formDate, "MMM d, yyyy") : <span>Pick a date</span>}
                          <Clock className="w-4 h-4 opacity-50" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-[10000] border-[#E5E7EB] bg-white" align="start">
                        <Calendar
                          mode="single"
                          selected={formDate}
                          onSelect={(date) => {
                            if (date) {
                              const d = new Date(formDate);
                              d.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                              setFormDate(d);
                            }
                          }}
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                          style={{
                            '--rdp-cell-size': '2rem',
                            '--rdp-accent-color': '#3E2723',
                            '--rdp-background-color': '#ffffff',
                            color: '#111827',
                            fontSize: '0.85rem',
                            padding: '0.5rem',
                          } as React.CSSProperties}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="flex w-full gap-4">
                    <div className="flex flex-col w-1/2">
                      <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">
                        Start Time <span className="text-red-500">*</span>
                      </label>
                      <Select
                        value={`${formDate.getHours().toString().padStart(2, '0')}:${formDate.getMinutes().toString().padStart(2, '0')}`}
                        onValueChange={(val) => {
                          const [h, m] = val.split(':').map(Number);
                          const d = new Date(formDate);
                          d.setHours(h, m);
                          setFormDate(d);
                        }}
                      >
                        <SelectTrigger
                          className={cn(
                            "w-full px-3 py-2 rounded-lg text-[14px] border-[#E5E7EB] focus:ring-0 focus:ring-offset-0 transition-colors",
                            "text-[#111827] bg-[#F9FAFB]"
                          )}
                        >
                          <SelectValue placeholder="Select time" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-[#E5E7EB] z-[10000]">
                          <ScrollArea className="h-[15rem]">
                            {Array.from({ length: 96 }).map((_, i) => {
                              const optH = Math.floor(i / 4);
                              const optM = (i % 4) * 15;
                              const hour = optH.toString().padStart(2, "0");
                              const minute = optM.toString().padStart(2, "0");
                              const ampm = optH >= 12 ? 'PM' : 'AM';
                              const displayHour = optH % 12 || 12;
                              const displayTime = `${displayHour}:${minute} ${ampm}`;
                              const val = `${hour}:${minute}`;

                              const now = new Date();
                              const isToday = formDate.toDateString() === now.toDateString();
                              const isPastTime = isToday && (optH < now.getHours() || (optH === now.getHours() && optM < now.getMinutes()));

                              return (
                                <SelectItem
                                  key={i}
                                  value={val}
                                  disabled={isPastTime}
                                  className="text-[13px] cursor-pointer hover:bg-[#F3F4F6] focus:bg-[#F3F4F6] data-[disabled]:opacity-40 data-[disabled]:pointer-events-none"
                                >
                                  {displayTime}
                                </SelectItem>
                              );
                            })}
                          </ScrollArea>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col w-1/2">
                      <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">
                        Duration <span className="text-red-500">*</span>
                      </label>
                      <Select
                        value={formDuration.toString()}
                        onValueChange={(val) => setFormDuration(Number(val))}
                      >
                        <SelectTrigger className="w-full px-3 py-2 rounded-lg text-[14px] text-[#111827] bg-[#F9FAFB] border-[#E5E7EB] focus:ring-0 focus:ring-offset-0">
                          <SelectValue placeholder="Select duration" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-[#E5E7EB] z-[10000]">
                          <SelectItem value="30" className="text-[13px] cursor-pointer hover:bg-[#F3F4F6] focus:bg-[#F3F4F6]">30 mins</SelectItem>
                          <SelectItem value="45" className="text-[13px] cursor-pointer hover:bg-[#F3F4F6] focus:bg-[#F3F4F6]">45 mins</SelectItem>
                          <SelectItem value="60" className="text-[13px] cursor-pointer hover:bg-[#F3F4F6] focus:bg-[#F3F4F6]">1 hour</SelectItem>
                          <SelectItem value="90" className="text-[13px] cursor-pointer hover:bg-[#F3F4F6] focus:bg-[#F3F4F6]">1.5 hours</SelectItem>
                          <SelectItem value="120" className="text-[13px] cursor-pointer hover:bg-[#F3F4F6] focus:bg-[#F3F4F6]">2 hours</SelectItem>
                          <SelectItem value="180" className="text-[13px] cursor-pointer hover:bg-[#F3F4F6] focus:bg-[#F3F4F6]">3 hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {step <= 2 && (
            <div className="flex items-center justify-between mt-8 pt-4 border-t border-[#E5E7EB]">
              <div>
                <button
                  onClick={() => { setMeetingMode(null); setStep(1); }}
                  className="px-5 py-2.5 rounded-xl text-[14px] font-bold hover:bg-[#F9FAFB] transition-colors text-[#374151] border border-[#E5E7EB] hover:border-[#D1D5DB] shadow-sm bg-white"
                >
                  Cancel
                </button>
              </div>
              <div className="flex gap-3">
                {step > 1 && (
                  <button
                    onClick={() => setStep(1)}
                    className="px-5 py-2.5 rounded-xl text-[14px] font-bold bg-[#3E2723]/5 text-[#3E2723] hover:bg-[#3E2723]/10 transition-colors"
                  >
                    Back
                  </button>
                )}
                <button
                  onClick={step === 2 ? () => handleSubmit(false) : () => setStep(2)}
                  disabled={isCreating || (step === 2 && !formTitle.trim())}
                  className="px-6 py-2.5 rounded-xl text-[14px] font-bold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-sm"
                  style={{ backgroundColor: '#3E2723' }}
                >
                  {step === 2 ? (isCreating ? 'Creating...' : 'Create Event') : 'Next'}
                </button>
              </div>
            </div>
          )}
        </CastTalkModal>
      )}

      {/* Step 3: Meeting Conflict — separate compact modal, sizes to content */}
      {meetingMode && step === 3 && (
        <CastTalkModal isOpen={step === 3} onClose={() => { setMeetingMode(null); setStep(1); }} maxWidth="max-w-[460px]">
          <div className="flex flex-col font-geist">
            {/* Title */}
            <h2 className="text-[20px] font-medium text-[#111827] leading-tight font-geist mb-2">
              Meeting Conflict
            </h2>

            {/* Description */}
            <p className="text-[15px] text-slate-600 leading-[24px] font-geist mb-5">
              Preferred meeting window overlaps an existing scheduled timeframe.
            </p>

            {/* Footer */}
            <div className="flex justify-end gap-3 pt-3 border-t border-[#E5E7EB]">
              <button
                onClick={() => setStep(2)}
                className="px-5 py-2.5 rounded-xl text-[14px] font-bold hover:bg-[#F9FAFB] transition-colors text-[#374151] border border-[#E5E7EB] hover:border-[#D1D5DB] shadow-sm bg-white font-geist"
              >
                Back
              </button>
              <button
                onClick={() => handleSubmit(true)}
                className="bg-[#3E2723] hover:opacity-90 text-white text-[14px] font-bold px-6 py-2.5 rounded-xl transition-all active:scale-[0.98] font-geist"
              >
                Continue
              </button>
            </div>
          </div>
        </CastTalkModal>
      )}

      {meetingLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setMeetingLink(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4 animate-slide-down">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-semibold text-black">Your meeting is ready</h2>
            </div>
            <p className="text-sm text-slate-500 mb-6">Share this link with people you want to meet with.</p>
            <div className="flex items-center gap-2 bg-[#f3f4f6] border border-[#c4cccc] rounded-lg px-4 py-3 mb-6">
              <span className="flex-1 text-sm text-slate-700 truncate">{meetingLink}</span>
              <div
                onClick={async () => { await navigator.clipboard.writeText(meetingLink!); toast({ title: 'Link copied!' }); }}
                className="cursor-pointer text-slate-500 hover:text-black transition-colors shrink-0 p-1.5 rounded-md hover:bg-black/5 flex items-center justify-center active:scale-95"
                title="Copy Link"
              >
                <Copy size={18} weight="bold" />
              </div>
            </div>
            <button
              onClick={() => setMeetingLink(null)}
              className="w-full py-3 bg-[#3E2723] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
