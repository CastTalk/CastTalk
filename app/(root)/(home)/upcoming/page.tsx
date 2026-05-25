'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { useGetCalls } from '@/hooks/useGetCalls';
import { Call } from '@stream-io/video-react-sdk';

const HOUR_HEIGHT = 72;
const START_HOUR = 0;
const END_HOUR = 24;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR);
const TIME_COL_W = 56;

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
  return HOUR_HEIGHT;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SchedulePage() {
  const router = useRouter();
  const { upcomingCalls, endedCalls, isLoading } = useGetCalls();
  const allCalls = [...(upcomingCalls ?? []), ...(endedCalls ?? [])];

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
    <div className="flex flex-col h-full font-geist select-none">

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 md:px-6 lg:px-8 py-4 border-b border-dashed border-[#c4cccc] shrink-0">
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
        <div className="flex shrink-0 border-b border-[#e5e7eb]" style={{ paddingLeft: TIME_COL_W }}>
          {weekDays.map((day) => {
            const isToday = day.toDateString() === today.toDateString();
            return (
              <div key={day.toISOString()} className="flex-1 flex flex-col items-center py-3 border-l border-[#e5e7eb] first:border-l-0">
                <span className={`text-xs font-medium uppercase tracking-wide ${isToday ? 'text-blue-600' : 'text-slate-400'}`}>
                  {DAY_NAMES[day.getDay()]}
                </span>
                <span className={`text-2xl font-light leading-tight mt-0.5 ${isToday ? 'text-blue-600' : 'text-slate-800'}`}>
                  {day.getDate()}
                </span>
              </div>
            );
          })}
        </div>

        {/* Scrollable grid */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="flex" style={{ height: HOURS.length * HOUR_HEIGHT }}>

            {/* Time gutter */}
            <div className="shrink-0 relative" style={{ width: TIME_COL_W }}>
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="absolute w-full flex items-start justify-end pr-2"
                  style={{ top: (h - START_HOUR) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                >
                  <span className="text-[11px] text-slate-400 -translate-y-2">
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
                  className="flex-1 relative border-l border-[#e5e7eb]"
                >
                  {/* Hour lines */}
                  {HOURS.map((h) => (
                    <div
                      key={h}
                      className="absolute w-full border-t border-[#e5e7eb]"
                      style={{ top: (h - START_HOUR) * HOUR_HEIGHT }}
                    />
                  ))}

                  {/* Half-hour lines */}
                  {HOURS.map((h) => (
                    <div
                      key={`half-${h}`}
                      className="absolute w-full border-t border-[#f0f0f0]"
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
                    const startTime = new Intl.DateTimeFormat('en-US', {
                      hour: 'numeric', minute: '2-digit', hour12: false,
                    }).format(new Date(call.state.startsAt!));
                    const isPast = !!call.state.endedAt || new Date(call.state.startsAt!) < today;

                    return (
                      <div
                        key={call.id}
                        className="absolute left-1 right-1 z-10 cursor-pointer rounded-sm overflow-hidden"
                        style={{ top: top + 1, height: height - 2 }}
                        onClick={() => router.push(`/meeting/${call.id}`)}
                      >
                        <div className={`h-full border-l-[3px] px-2 py-1 text-xs leading-snug transition-opacity hover:opacity-80 ${
                          isPast
                            ? 'bg-slate-100 border-slate-400 text-slate-500'
                            : 'bg-blue-50 border-blue-500 text-slate-800'
                        }`}>
                          <p className="font-semibold truncate">{title}</p>
                          <p className="text-slate-500">{startTime}</p>
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
    </div>
  );
}
