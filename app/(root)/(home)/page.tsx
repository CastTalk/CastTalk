'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useStreamVideoClient, Call } from '@stream-io/video-react-sdk';
import {
  ArrowRight, Link as LinkIcon, Plus, X,
  ChatCircle, Clock,
  Copy, Lock, Globe, CalendarPlus, SpinnerGap, CalendarCheck,
} from '@phosphor-icons/react';
import { useToast } from '@/components/ui/use-toast';
import Loader from '@/components/Loader';
import { NoiseTexture } from '@/components/ui/noise-texture';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn, generateShortMeetingId } from '@/lib/utils';
import { format } from 'date-fns';
import CastTalkModal from '@/components/CastTalkModal';

type MeetingMode = 'later' | 'instant' | null;

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
  const [step, setStep] = useState(1);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formDate, setFormDate] = useState(new Date());
  const [formDuration, setFormDuration] = useState(60); // Default to 1 hour
  const [meetingType, setMeetingType] = useState<'general' | 'secure'>('general');
  const [previewId, setPreviewId] = useState('');
  const [meetingLink, setMeetingLink] = useState<string | null>(null);

  // Scheduled meeting join flow state
  const [showScheduledJoinModal, setShowScheduledJoinModal] = useState(false);
  const [showNotStartedModal, setShowNotStartedModal] = useState(false);
  const [scheduledMeetingInfo, setScheduledMeetingInfo] = useState<{
    meetingId: string;
    title: string;
    startsAt: string;
    duration: number;
    meetingType: string;
    alreadyAdded?: boolean;
    isHost?: boolean;
  } | null>(null);
  const [notStartedInfo, setNotStartedInfo] = useState<{
    title: string;
    startsAt: string;
  } | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [isCheckingSchedule, setIsCheckingSchedule] = useState(false);

  const closeDropdown = () => {
    setDropdownClosing(true);
    setTimeout(() => { setShowDropdown(false); setDropdownClosing(false); }, 150);
  };

  const openModal = (mode: MeetingMode) => {
    setFormTitle(''); setFormDesc('');
    const d = new Date();
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15);
    d.setSeconds(0);
    d.setMilliseconds(0);
    setFormDate(d);
    setFormDuration(60); // Reset duration to 1 hour
    setMeetingType('general');
    setPreviewId(generateShortMeetingId());
    setMeetingMode(mode);
    setStep(1);
    closeDropdown();
  };

  const previewLink = typeof window !== 'undefined' ? `${window.location.origin}/meeting/${previewId}` : '';

  const handleSubmit = async (bypassConflict = false) => {
    if (!client || !user) return;
    try {
      setIsCreating(true);

      // Check conflict if scheduling a meeting for later
      if (meetingMode === 'later' && !bypassConflict) {
        const proposedStart = formDate;
        const proposedEnd = new Date(formDate.getTime() + formDuration * 60000);

        // Fetch existing calls
        const { calls } = await client.queryCalls({
          sort: [{ field: 'starts_at', direction: -1 }],
          filter_conditions: {
            starts_at: { $exists: true },
            $or: [
              { created_by_user_id: user.id },
              { members: { $in: [user.id] } },
            ],
          },
        });

        // 30 minute buffer interval
        const BUFFER = 30 * 60000;
        let conflictDetected = false;

        const now = new Date();
        for (const call of (calls || [])) {
          const startsAtStr = call.state.startsAt;
          if (!startsAtStr) continue;

          const sExisting = new Date(startsAtStr);
          const dExisting = Number(call.state.custom?.duration || 60);
          const eExisting = new Date(sExisting.getTime() + dExisting * 60000);

          // Skip meetings that have already fully completed
          if (eExisting < now) continue;

          // If the call was already ended/completed, skip it
          if (call.state.endedAt) continue;

          // Check overlap with 30-min buffer:
          // They DON'T overlap if and only if:
          // proposedEnd + 30m <= sExisting OR proposedStart >= eExisting + 30m
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
      const startsAt = meetingMode === 'instant' ? new Date().toISOString() : formDate.toISOString();
      
      const createCallData = {
        data: {
          starts_at: startsAt,
          custom: {
            title: formTitle || 'Untitled Meeting',
            description: formDesc,
            meetingType,
            duration: formDuration,
          },
        },
      };

      // Attempt getOrCreate with automatic retry for resilience against network latency
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await call.getOrCreate(createCallData);
          break;
        } catch (err: any) {
          console.warn(`[Meeting Create attempt ${attempt + 1} failed]:`, err);
          if (attempt === 0) {
            await new Promise((r) => setTimeout(r, 800));
          } else {
            throw err;
          }
        }
      }

      // Sync manual meeting into Appwrite schedules database
      await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingId: call.id,
          title: formTitle || (meetingMode === 'instant' ? 'Instant Meeting' : 'Scheduled Meeting'),
          description: formDesc || '',
          startsAt,
          duration: formDuration,
          meetingType: meetingMode === 'instant' ? 'instant' : meetingType
        })
      }).catch(err => console.error('[Error syncing manual schedule to Appwrite DB]:', err));

      if (meetingMode === 'later') {
        setMeetingMode(null);
        setStep(1);
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

  const extractMeetingId = (input: string): string => {
    // Extract meeting ID from URL or use as-is if it's just a code
    if (input.includes('/meeting/')) {
      const parts = input.split('/meeting/');
      return parts[parts.length - 1].replace(/[\/\?#].*/g, '').trim();
    }
    return input.trim();
  };

  const joinMeeting = async () => {
    if (!linkOrCode) return;
    const meetingId = extractMeetingId(linkOrCode);
    if (!meetingId) return;

    try {
      setIsCheckingSchedule(true);
      // Check if this is a scheduled meeting
      const res = await fetch(`/api/schedules/join?meetingId=${encodeURIComponent(meetingId)}`);
      const data = await res.json();

      if (data.isScheduled && data.isFuture) {
        if (data.alreadyAdded || data.isHost) {
          // Already in calendar or user is host but meeting hasn't started yet — show warning modal
          setNotStartedInfo({
            title: data.schedule.title,
            startsAt: data.schedule.startsAt,
          });
          setShowNotStartedModal(true);
        } else {
          // Show scheduled meeting modal to offer adding to calendar
          setScheduledMeetingInfo({
            meetingId: data.schedule.meetingId,
            title: data.schedule.title,
            startsAt: data.schedule.startsAt,
            duration: data.schedule.duration,
            meetingType: data.schedule.meetingType,
            alreadyAdded: data.alreadyAdded,
            isHost: data.isHost,
          });
          setShowScheduledJoinModal(true);
        }
      } else {
        // Not a scheduled meeting, or meeting has already started — navigate directly to room
        router.push(`/meeting/${meetingId}`);
      }
    } catch (err) {
      console.error('[Join Check Error]:', err);
      // If check fails, fallback to direct navigation
      router.push(`/meeting/${meetingId}`);
    } finally {
      setIsCheckingSchedule(false);
    }
  };

  const handleAddToCalendar = async () => {
    if (!scheduledMeetingInfo) return;
    const info = scheduledMeetingInfo;
    try {
      setIsJoining(true);
      const res = await fetch('/api/schedules/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId: info.meetingId }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Meeting added to your calendar!' });
      }
    } catch (err) {
      console.error('[Add to Calendar Error]:', err);
      toast({ title: 'Failed to add to calendar' });
    } finally {
      setIsJoining(false);
      setShowScheduledJoinModal(false);
      setScheduledMeetingInfo(null);
    }
  };

  if (!isLoaded) return <Loader />;

  return (
    <>
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
            Connect, collaborate, and celebrate from anywhere with CastTalk
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
                    <button onClick={() => openModal('instant')} className="w-full flex items-center gap-4 px-5 py-4 text-[15px] font-normal text-black hover:bg-black/5 transition-colors">
                      <Plus size={22} weight="regular" />
                      Start an instant meeting
                    </button>
                    <div className="h-px bg-black/10 mx-4" />
                    <button onClick={() => openModal('later')} className="w-full flex items-center gap-4 px-5 py-4 text-[15px] font-normal text-black hover:bg-black/5 transition-colors">
                      <LinkIcon size={22} weight="regular" />
                      Create a meeting for later
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
                className="w-full pl-4 pr-20 py-3.5 bg-transparent border border-black text-black rounded-none focus:outline-none focus:ring-1 focus:ring-black transition-all placeholder:text-slate-500"
              />
              <button
                onClick={joinMeeting}
                disabled={!linkOrCode || isCheckingSchedule}
                className={`absolute right-1 top-1 bottom-1 px-5 rounded-none font-medium transition-colors ${linkOrCode && !isCheckingSchedule ? 'text-black hover:bg-black/5' : 'text-slate-400 cursor-not-allowed'}`}
              >
                {isCheckingSchedule ? <SpinnerGap size={18} className="animate-spin" /> : 'Join'}
              </button>
            </div>
          </div>
        </div>
      </div>

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

          <div className={cn(
            "relative w-full transition-all duration-300 overflow-hidden",
            (step === 2 && meetingType === 'general') ? "h-[140px]" : "h-[300px]"
          )}>
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
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[13px] font-medium text-[#374151]">
                        Event Topic <span className="text-red-500">*</span>
                      </label>
                      {formTitle.length > 0 && (
                        <span className={`text-[11px] font-medium transition-colors ${formTitle.length >= 20 ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>
                          {formTitle.length}/20
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      maxLength={20}
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


                  {meetingType !== 'general' && (
                    <>
                      <div className="flex flex-col w-full">
                        <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">
                          Start Date <span className="text-red-500">*</span>
                        </label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              disabled={meetingMode === 'instant'}
                              className={cn(
                                "w-full px-3 py-2 rounded-lg text-[14px] outline-none flex items-center justify-between transition-colors",
                                !formDate ? "text-[#9CA3AF]" : "text-[#111827]",
                                meetingMode === 'instant' && "disabled:opacity-50 disabled:cursor-not-allowed"
                              )}
                              style={{
                                backgroundColor: '#F9FAFB',
                                backgroundImage: 'none',
                                border: '1px solid #E5E7EB'
                              }}
                            >
                              {meetingMode === 'instant' ? <span>Today</span> : (formDate ? format(formDate, "MMM d, yyyy") : <span>Pick a date</span>)}
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
                            disabled={meetingMode === 'instant'}
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
                                "text-[#111827] bg-[#F9FAFB] disabled:opacity-50 disabled:cursor-not-allowed"
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
                            disabled={meetingMode === 'instant'}
                            value={formDuration.toString()}
                            onValueChange={(val) => setFormDuration(Number(val))}
                          >
                            <SelectTrigger className="w-full px-3 py-2 rounded-lg text-[14px] text-[#111827] bg-[#F9FAFB] border-[#E5E7EB] focus:ring-0 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed">
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
                    </>
                  )}
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

      {/* Scheduled Meeting Join Modal */}
      {showScheduledJoinModal && scheduledMeetingInfo && (
        <CastTalkModal
          isOpen={showScheduledJoinModal}
          onClose={() => {
            setShowScheduledJoinModal(false);
            setScheduledMeetingInfo(null);
          }}
          maxWidth="max-w-[420px]"
        >
          <div className="flex flex-col font-geist">
            <h2 className="text-[20px] font-medium text-[#111827] leading-none mb-2.5">
              Scheduled Meeting
            </h2>
            <p className="text-[14px] text-slate-500 leading-relaxed mb-6">
              "{scheduledMeetingInfo.title}" is scheduled for {new Date(scheduledMeetingInfo.startsAt).toLocaleString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              })}. Would you like to add it to your calendar?
            </p>
            <div className="flex justify-end gap-3 pt-4 border-t border-[#E5E7EB]">
              <button
                type="button"
                onClick={() => {
                  setShowScheduledJoinModal(false);
                  setScheduledMeetingInfo(null);
                }}
                className="px-5 py-2.5 rounded-xl text-[14px] font-bold hover:bg-[#F9FAFB] transition-colors text-[#374151] border border-[#E5E7EB] hover:border-[#D1D5DB] shadow-sm bg-white"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleAddToCalendar}
                disabled={isJoining}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[14px] font-bold px-6 py-2.5 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 shadow-sm"
              >
                {isJoining ? 'Adding...' : 'Add to calendar'}
              </button>
            </div>
          </div>
        </CastTalkModal>
      )}

      {/* Meeting Not Started Warning Modal */}
      {showNotStartedModal && notStartedInfo && (
        <CastTalkModal
          isOpen={showNotStartedModal}
          onClose={() => {
            setShowNotStartedModal(false);
            setNotStartedInfo(null);
          }}
          maxWidth="max-w-[420px]"
        >
          <div className="flex flex-col font-geist">
            <h2 className="text-[20px] font-medium text-[#111827] leading-none mb-2.5">
              Meeting Not Started
            </h2>
            <p className="text-[14px] text-slate-500 leading-relaxed mb-6">
              Your meeting has not started yet. It is scheduled for {new Date(notStartedInfo.startsAt).toLocaleString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              })}.
            </p>
            <div className="flex justify-end gap-3 pt-4 border-t border-[#E5E7EB]">
              <button
                type="button"
                onClick={() => {
                  setShowNotStartedModal(false);
                  setNotStartedInfo(null);
                }}
                className="bg-[#3E2723] hover:opacity-90 text-white text-[14px] font-bold px-6 py-2.5 rounded-xl transition-all active:scale-[0.98] shadow-sm"
              >
                Back to Home
              </button>
            </div>
          </div>
        </CastTalkModal>
      )}
    </>
  );
};

export default Home;
