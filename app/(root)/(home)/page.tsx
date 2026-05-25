'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useStreamVideoClient, Call } from '@stream-io/video-react-sdk';
import {
  ArrowRight, Link as LinkIcon, Plus, X,
  CaretLeft, CaretRight, ChatCircle, Clock,
  CaretDown, Copy, ClipboardText, Lock, Globe,
} from '@phosphor-icons/react';
import { useToast } from '@/components/ui/use-toast';
import Loader from '@/components/Loader';
import { NoiseTexture } from '@/components/ui/noise-texture';
import { useGetCalls } from '@/hooks/useGetCalls';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths,
  format
} from 'date-fns';

type MeetingMode = 'later' | 'instant' | null;

// ── Time helpers ───────────────────────────────────────────────────────────
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TIME_SLOTS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 30) {
    TIME_SLOTS.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
  }
}
function fmt12(t: string) {
  const [h, m] = t.split(':').map(Number);
  const p = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m.toString().padStart(2, '0')} ${p}`;
}
function nearestSlot() {
  const n = new Date();
  const h = n.getMinutes() < 30 ? n.getHours() : n.getHours() + 1;
  const rm = n.getMinutes() < 30 ? 30 : 0;
  return `${(h % 24).toString().padStart(2, '0')}:${rm.toString().padStart(2, '0')}`;
}
function fmtDateBtn(d: Date) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${days[d.getDay()]} ${d.getDate()}, ${MONTH_NAMES[d.getMonth()]}`;
}

// ── Mini calendar helpers ──────────────────────────────────────────────────
const MINI_HOUR_H = 64;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function callsForDay(calls: Call[], date: Date) {
  return calls.filter(c => c.state.startsAt && new Date(c.state.startsAt).toDateString() === date.toDateString());
}
function callTop(call: Call, startHour: number) {
  const d = new Date(call.state.startsAt!);
  return (d.getHours() + d.getMinutes() / 60 - startHour) * MINI_HOUR_H;
}
function callH(call: Call) {
  const s = call.state.startsAt!;
  const e = call.state.endedAt;
  if (e) return Math.max((new Date(e).getTime() - new Date(s).getTime()) / 3600000 * MINI_HOUR_H, MINI_HOUR_H * 0.5);
  return MINI_HOUR_H * 1;
}

// Field component from reference
function Field({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 mb-[10px]">
      <Icon className="mt-[7px] h-4 w-4 shrink-0 text-slate-600" weight="regular" />
      <div className="flex-1">{children}</div>
    </div>
  );
}

const Home = () => {
  const router = useRouter();
  const [linkOrCode, setLinkOrCode] = useState('');
  const { user, isLoaded } = useUser();
  const client = useStreamVideoClient();
  const { toast } = useToast();

  const [isCreating, setIsCreating] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownClosing, setDropdownClosing] = useState(false);
  const [meetingMode, setMeetingMode] = useState<MeetingMode>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formDate, setFormDate] = useState(new Date());
  const [monthView, setMonthView] = useState(new Date());
  const [meetingType, setMeetingType] = useState<'general' | 'secure'>('general');
  const [previewId, setPreviewId] = useState('');
  const [meetingLink, setMeetingLink] = useState<string | null>(null);

  // mini calendar
  const { upcomingCalls, endedCalls } = useGetCalls();
  const allCalls = [...(upcomingCalls ?? []), ...(endedCalls ?? [])];
  const [calDate, setCalDate] = useState(new Date());
  const [nowMin, setNowMin] = useState(() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); });
  useEffect(() => {
    const t = setInterval(() => { const n = new Date(); setNowMin(n.getHours() * 60 + n.getMinutes()); }, 60000);
    return () => clearInterval(t);
  }, []);

  const closeDropdown = () => {
    setDropdownClosing(true);
    setTimeout(() => { setShowDropdown(false); setDropdownClosing(false); }, 150);
  };

  const openModal = (mode: MeetingMode) => {
    setFormTitle(''); setFormDesc('');
    const now = new Date();
    const slot = nearestSlot();
    const [sh, sm] = slot.split(':').map(Number);
    now.setHours(sh, sm, 0, 0);
    setFormDate(now);
    setMonthView(now);
    setMeetingType('general');
    setPreviewId(crypto.randomUUID());
    setMeetingMode(mode);
    closeDropdown();
  };

  const previewLink = typeof window !== 'undefined' ? `${window.location.origin}/meeting/${previewId}` : '';

  const handleSubmit = async () => {
    if (!client || !user) return;
    try {
      setIsCreating(true);
      const call = client.call('default', previewId);
      if (!call) throw new Error('Failed to create meeting');
      const startsAt = meetingMode === 'instant' ? new Date().toISOString() : formDate.toISOString();
      await call.getOrCreate({
        data: {
          starts_at: startsAt,
          custom: {
            title: formTitle || 'Untitled Meeting',
            description: formDesc,
            meetingType,
          }
        },
      });
      if (meetingMode === 'later') {
        setMeetingMode(null);
        setMeetingLink(`${window.location.origin}/meeting/${call.id}`);
      } else {
        router.push(`/meeting/${call.id}`);
        toast({ title: 'Meeting started' });
      }
    } catch (error) {
      console.error(error);
      toast({ title: 'Failed to create meeting' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    const nextDate = new Date(formDate);
    nextDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
    setFormDate(nextDate);
  };

  const handleTimeChange = (type: 'hour' | 'minute' | 'ampm', value: string) => {
    const nextDate = new Date(formDate);
    if (type === 'hour') {
      const h12 = parseInt(value, 10);
      const isPM = nextDate.getHours() >= 12;
      nextDate.setHours(isPM ? (h12 === 12 ? 12 : h12 + 12) : (h12 === 12 ? 0 : h12));
    } else if (type === 'minute') {
      nextDate.setMinutes(parseInt(value, 10));
    } else if (type === 'ampm') {
      const h24 = nextDate.getHours();
      if (value === 'AM' && h24 >= 12) {
        nextDate.setHours(h24 - 12);
      } else if (value === 'PM' && h24 < 12) {
        nextDate.setHours(h24 + 12);
      }
    }
    setFormDate(nextDate);
  };

  const joinMeeting = () => {
    if (linkOrCode) router.push(linkOrCode.includes('http') ? linkOrCode : `/meeting/${linkOrCode}`);
  };

  if (!isLoaded) return <Loader />;

  return (
    <>
      { }
      <div className="relative flex-1 overflow-hidden">
        <NoiseTexture className="opacity-[0.15]" />
        <div
          className="absolute inset-0 z-0 pointer-events-none opacity-50"
          style={{
            backgroundImage: `linear-gradient(to right, #c4cccc 1px, transparent 1px), linear-gradient(to bottom, #c4cccc 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />
        <div className="relative z-10 pt-32 px-4 md:px-6 lg:px-8 flex flex-col">
          <h1 className="text-5xl md:text-6xl lg:text-[5.5rem] font-geist font-normal leading-[1.05] tracking-tight text-black mb-8 max-w-[1000px]">
            Video calls and meetings for everyone
          </h1>
          <p className="text-[1.1rem] md:text-[1.25rem] font-geist text-slate-600 mb-12 max-w-3xl leading-relaxed">
            Connect, collaborate, and celebrate from anywhere with  CastTalk
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4 max-w-xl">
            <div className="relative w-full sm:w-auto">
              <button
                onClick={() => showDropdown ? closeDropdown() : setShowDropdown(true)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#121212] hover:bg-black text-white px-8 py-3.5 rounded-none text-[17px] !font-normal transition-colors"
              >
                New meeting
                <ArrowRight size={18} weight="regular" />
              </button>
              {showDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={closeDropdown} />
                  <div 
                    className={cn(
                      "absolute left-0 top-full mt-2 z-50 w-72 bg-[#ecedef] border border-black/10 shadow-lg rounded-none overflow-hidden",
                      dropdownClosing ? 'animate-slide-up' : 'animate-slide-down'
                    )}
                    style={{ borderWidth: '0.8px' }}
                  >
                    <button onClick={() => openModal('later')} className="w-full flex items-center gap-4 px-5 py-4 text-[15px] font-normal text-black hover:bg-black/5 transition-colors">
                      <LinkIcon size={22} weight="regular" />
                      Create a meeting for later
                    </button>
                    <div className="h-px bg-black/10 mx-4" />
                    <button onClick={() => openModal('instant')} className="w-full flex items-center gap-4 px-5 py-4 text-[15px] font-normal text-black hover:bg-black/5 transition-colors">
                      <Plus size={22} weight="regular" />
                      Start an instant meeting
                    </button>
                  </div>
                </>
              )}
            </div>
            <div className="flex flex-1 w-full relative">
              <input
                type="text"
                placeholder="Enter a code or link"
                value={linkOrCode}
                onChange={(e) => setLinkOrCode(e.target.value)}
                className="w-full px-4 py-3.5 bg-transparent border border-black text-black rounded-none focus:outline-none focus:ring-1 focus:ring-black transition-all placeholder:text-slate-500"
              />
              <button
                onClick={joinMeeting}
                disabled={!linkOrCode}
                className={`absolute right-1 top-1 bottom-1 px-5 rounded-none font-medium transition-colors ${linkOrCode ? 'text-black hover:bg-black/5' : 'text-slate-400 cursor-not-allowed'}`}
              >
                Join
              </button>
            </div>
          </div>
        </div>
      </div>

      {meetingMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMeetingMode(null)} />
          <div className={cn(
            "relative flex flex-col w-full max-w-[600px] overflow-hidden rounded-sm bg-[#ecedef] border border-black/10 shadow-[inset_0_1px_0_#ffffff,_0_1px_3px_rgba(0,0,0,0.02),_0_24px_50px_-12px_rgba(0,0,0,0.06)] transition-all duration-300",
            meetingMode ? 'animate-slide-down' : ''
          )}>
            {/* Top Premium Accent Bar */}
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-primary via-[#3b82f6] to-primary z-30" />
            
            <NoiseTexture className="opacity-[0.12]" />
            {/* Close Button */}
            <button
              onClick={() => setMeetingMode(null)}
              className="absolute top-5 right-5 p-1.5 hover:bg-black/5 hover:text-black text-slate-500 rounded-none transition-colors z-20"
              title="Close modal"
            >
              <X size={18} weight="bold" className="text-black" />
            </button>

            {/* Content Container */}
            <div className="relative z-10 flex flex-col p-10 pt-9 flex-1">
              {/* Premium Title Section with Pulsing Accent Dot & Large Font but NOT Bold */}
              <div className="mb-6 pl-1 flex items-center gap-2">
                <div className="size-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(0,75,255,0.7)]" />
                <h2 className="text-[28px] !font-normal tracking-tight text-[#110b21]">New Meeting</h2>
              </div>

              {/* Form Fields */}
              <div className="flex flex-col gap-5">
                {/* Topic Field */}
                <div className="flex flex-col gap-1.5 group">
                  <label className="text-[11px] font-bold text-slate-900 pl-1 uppercase tracking-wider transition-colors duration-300 group-focus-within:text-primary">Topic</label>
                  <div className="flex items-center gap-3 bg-white border border-slate-300 px-4 py-2.5 rounded-none focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 hover:border-slate-400 transition-all duration-300" style={{ borderWidth: '0.8px' }}>
                    <ChatCircle className="h-5 w-5 text-slate-500 shrink-0 group-focus-within:text-primary group-hover:text-primary transition-colors duration-300" />
                    <input
                      type="text"
                      placeholder="Risk discussion"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="w-full bg-transparent text-sm text-[#110b21] outline-none placeholder:text-slate-400 font-normal"
                    />
                  </div>
                </div>

                {/* Date & Time + Meeting Type Row */}
                <div className="flex gap-4 w-full">
                  {/* Date & Time Field (65%) */}
                  <div className="w-[65%] flex flex-col gap-1.5 group">
                    <label className="text-[11px] font-bold text-slate-900 pl-1 uppercase tracking-wider transition-colors duration-300 group-focus-within:text-primary">Date & Time</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button 
                          disabled={meetingMode === 'instant'}
                          className="flex w-full items-center gap-3 bg-white disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed border border-slate-300 px-4 py-2.5 rounded-none text-left font-normal text-black focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 hover:border-slate-400 transition-all duration-300" 
                          style={{ borderWidth: '0.8px' }}
                        >
                          <Clock className="h-5 w-5 text-slate-500 shrink-0 group-hover:text-primary transition-colors duration-300" />
                          <span className={cn("flex-1 text-sm font-normal", meetingMode === 'instant' ? "text-slate-400" : "text-[#110b21]")}>
                            {meetingMode === 'instant' ? "Now (Instant Meeting)" : format(formDate, "EEE d, MMM | hh:mm aa | '30M'")}
                          </span>
                          <CaretDown className="h-4 w-4 text-slate-400 opacity-70 shrink-0 transition-colors group-hover:text-slate-600" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-50 bg-white border border-slate-200 shadow-xl rounded-none" align="start">
                        <div className="sm:flex items-stretch bg-white">
                          {/* Custom Pure-React Calendar */}
                          <div className="p-3 bg-white select-none">
                            <div className="flex items-center justify-between mb-3">
                              <button 
                                type="button" 
                                onClick={() => setMonthView(subMonths(monthView, 1))} 
                                className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
                              >
                                <CaretLeft size={16} weight="bold" />
                              </button>
                              <span className="text-xs font-bold text-slate-800">
                                {format(monthView, 'MMMM yyyy')}
                              </span>
                              <button 
                                type="button" 
                                onClick={() => setMonthView(addMonths(monthView, 1))} 
                                className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
                              >
                                <CaretRight size={16} weight="bold" />
                              </button>
                            </div>
                            
                            <div className="grid grid-cols-7 gap-1 text-center mb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                                <div key={d} className="w-7 h-7 flex items-center justify-center">{d}</div>
                              ))}
                            </div>
                            
                            <div className="grid grid-cols-7 gap-1 text-center">
                              {(() => {
                                const startOfGrid = startOfWeek(startOfMonth(monthView));
                                const endOfGrid = endOfWeek(endOfMonth(monthView));
                                const daysGrid = eachDayOfInterval({ start: startOfGrid, end: endOfGrid });
                                return daysGrid.map((day, idx) => {
                                  const isSelected = isSameDay(day, formDate);
                                  const isCurrentMonth = isSameMonth(day, monthView);
                                  return (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => handleDateSelect(day)}
                                      className={cn(
                                        "w-7 h-7 rounded-full text-[11px] font-semibold flex items-center justify-center transition-all duration-200",
                                        isSelected 
                                          ? "bg-primary text-white hover:bg-primary/90 shadow-md shadow-primary/20" 
                                          : isCurrentMonth
                                            ? "text-slate-800 hover:bg-slate-100"
                                            : "text-slate-300 hover:bg-slate-50"
                                      )}
                                    >
                                      {day.getDate()}
                                    </button>
                                  );
                                });
                              })()}
                            </div>
                          </div>

                          {/* Interactive Time Picker Columns with completely hidden scrollbars */}
                          <div className="flex flex-col sm:flex-row h-[220px] border-t sm:border-t-0 sm:border-l border-slate-100 bg-white">
                            {/* Hour Column */}
                            <div className="w-[52px] overflow-y-auto border-r border-slate-50 flex flex-col p-1 no-scrollbar">
                              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider text-center py-1">Hour</div>
                              {Array.from({ length: 12 }, (_, i) => i + 1).map((hour) => {
                                const currentHour12 = formDate.getHours() % 12 || 12;
                                const isSelected = currentHour12 === hour;
                                return (
                                  <button
                                    key={hour}
                                    type="button"
                                    onClick={() => handleTimeChange("hour", hour.toString())}
                                    className={cn(
                                      "w-full h-7 text-[11px] font-semibold rounded flex items-center justify-center shrink-0 transition-colors duration-150",
                                      isSelected ? "bg-primary text-white shadow-sm" : "text-slate-700 hover:bg-slate-100"
                                    )}
                                  >
                                    {hour}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Minute Column */}
                            <div className="w-[52px] overflow-y-auto border-r border-slate-50 flex flex-col p-1 no-scrollbar">
                              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider text-center py-1">Min</div>
                              {Array.from({ length: 12 }, (_, i) => i * 5).map((minute) => {
                                const currentMinute = formDate.getMinutes();
                                const isSelected = Math.abs(currentMinute - minute) < 2.5 || (minute === 0 && currentMinute >= 58) || (minute === 55 && currentMinute <= 2);
                                return (
                                  <button
                                    key={minute}
                                    type="button"
                                    onClick={() => handleTimeChange("minute", minute.toString())}
                                    className={cn(
                                      "w-full h-7 text-[11px] font-semibold rounded flex items-center justify-center shrink-0 transition-colors duration-150",
                                      isSelected ? "bg-primary text-white shadow-sm" : "text-slate-700 hover:bg-slate-100"
                                    )}
                                  >
                                    {minute.toString().padStart(2, "0")}
                                  </button>
                                );
                              })}
                            </div>

                            {/* AM/PM Column */}
                            <div className="w-[52px] flex flex-col p-1">
                              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider text-center py-1">Period</div>
                              {["AM", "PM"].map((ampm) => {
                                const isPM = formDate.getHours() >= 12;
                                const isSelected = (ampm === "AM" && !isPM) || (ampm === "PM" && isPM);
                                return (
                                  <button
                                    key={ampm}
                                    type="button"
                                    onClick={() => handleTimeChange("ampm", ampm)}
                                    className={cn(
                                      "w-full h-7 text-[11px] font-semibold rounded flex items-center justify-center shrink-0 transition-colors duration-150",
                                      isSelected ? "bg-primary text-white shadow-sm" : "text-slate-700 hover:bg-slate-100"
                                    )}
                                  >
                                    {ampm}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Meeting Type Field (35%) */}
                  <div className="w-[35%] flex flex-col gap-1.5 group">
                    <label className="text-[11px] font-bold text-slate-900 pl-1 uppercase tracking-wider transition-colors duration-300 group-focus-within:text-primary">Meeting Type</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="flex w-full items-center gap-3 bg-white border border-slate-300 px-4 py-2.5 rounded-none text-left font-normal text-black focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 hover:border-slate-400 transition-all duration-300" style={{ borderWidth: '0.8px' }}>
                          {meetingType === 'general' ? (
                            <>
                              <Globe className="h-5 w-5 text-slate-500 shrink-0 group-hover:text-primary transition-colors duration-300" />
                              <span className="flex-1 text-sm font-normal text-[#110b21]">General</span>
                            </>
                          ) : (
                            <>
                              <Lock className="h-5 w-5 text-slate-500 shrink-0 group-hover:text-primary transition-colors duration-300" />
                              <span className="flex-1 text-sm font-normal text-[#110b21]">Secure</span>
                            </>
                          )}
                          <CaretDown className="h-4 w-4 text-slate-400 opacity-70 shrink-0 transition-colors group-hover:text-slate-600" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-48 p-1 z-50 bg-white border border-slate-200 shadow-xl rounded-none">
                        <button
                          type="button"
                          onClick={() => setMeetingType('general')}
                          className={cn(
                            "w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-none text-left transition-colors font-medium",
                            meetingType === 'general' ? "bg-primary/10 text-primary font-semibold" : "text-slate-700 hover:bg-slate-50"
                          )}
                        >
                          <Globe className="h-4 w-4 text-slate-700 shrink-0" />
                          <div className="flex flex-col">
                            <span className="font-semibold text-xs text-black">General</span>
                            <span className="text-[9px] text-slate-500">Public link</span>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setMeetingType('secure')}
                          className={cn(
                            "w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-none text-left transition-colors font-medium mt-1",
                            meetingType === 'secure' ? "bg-primary/10 text-primary font-semibold" : "text-slate-700 hover:bg-slate-50"
                          )}
                        >
                          <Lock className="h-4 w-4 text-slate-700 shrink-0" />
                          <div className="flex flex-col">
                            <span className="font-semibold text-xs text-black">Secure</span>
                            <span className="text-[9px] text-slate-500">Encrypted</span>
                          </div>
                        </button>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Access Link Field */}
                <div className="flex flex-col gap-1.5 group">
                  <label className="text-[11px] font-bold text-slate-900 pl-1 uppercase tracking-wider transition-colors duration-300 group-focus-within:text-primary">Access Link</label>
                  <div className="flex items-center justify-between gap-3 bg-white border border-slate-300 px-4 py-2 rounded-none focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 hover:border-slate-400 transition-all duration-300" style={{ borderWidth: '0.8px' }}>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <LinkIcon className="h-5 w-5 text-slate-500 shrink-0 group-focus-within:text-primary group-hover:text-primary transition-colors duration-300" />
                      <span className="text-sm text-slate-700 truncate font-normal">{previewLink}</span>
                    </div>
                    <button
                      type="button"
                      onClick={async () => { await navigator.clipboard.writeText(previewLink); toast({ title: 'Link copied!' }); }}
                      className="p-1 border border-slate-300 hover:bg-slate-50 hover:border-slate-400 text-slate-700 hover:text-black transition-colors shrink-0 rounded-none"
                      style={{ borderWidth: '0.8px' }}
                      title="Copy link"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Actions Row */}
                <div className="flex justify-end gap-3 pt-6 border-t border-[#121212]/10 mt-3">
                  <button
                    onClick={() => setMeetingMode(null)}
                    className="w-32 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 hover:text-black text-xs font-bold uppercase tracking-wider transition-all duration-300 rounded-none"
                    style={{ borderWidth: '0.8px' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isCreating || !formTitle.trim()}
                    className="w-32 py-2 border border-black bg-black hover:bg-primary hover:border-primary hover:shadow-lg hover:shadow-primary/25 text-white text-xs font-bold uppercase tracking-wider transition-all duration-300 rounded-none disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ borderWidth: '0.8px' }}
                  >
                    {isCreating ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      { }
      {meetingLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setMeetingLink(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4 animate-slide-down">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xl font-semibold text-black">Your meeting is ready</h2>
              <button onClick={() => setMeetingLink(null)} className="p-1 hover:bg-black/5 rounded-full transition-colors">
                <X size={20} weight="bold" />
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-6">Share this link with people you want to meet with.</p>
            <div className="flex items-center gap-2 bg-[#f3f4f6] border border-[#c4cccc] rounded-lg px-4 py-3 mb-6">
              <span className="flex-1 text-sm text-slate-700 truncate">{meetingLink}</span>
              <button
                onClick={async () => { await navigator.clipboard.writeText(meetingLink!); toast({ title: 'Link copied!' }); }}
                className="text-sm font-medium text-black hover:underline shrink-0"
              >
                Copy
              </button>
            </div>
            <button
              onClick={() => setMeetingLink(null)}
              className="w-full py-3 bg-[#121212] text-white rounded-lg font-medium hover:bg-black transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Home;
