'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useStreamVideoClient, Call } from '@stream-io/video-react-sdk';
import { Clock, Copy, Lock, Globe, SpinnerGap } from '@/components/icons';
import { useToast } from '@/components/ui/use-toast';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import Loader from '@/components/Loader';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn, generateShortMeetingId } from '@/lib/utils';
import { format } from 'date-fns';
import CastTalkModal from '@/components/CastTalkModal';
import EmberAurora from '@/components/home/EmberAurora';
import GlowWord from '@/components/home/GlowWord';
import EmberPixels from '@/components/EmberPixels';
import HeroLaptopMockup from '@/components/home/HeroLaptopMockup';
import { Close as PixelClose, Keyboard as PixelKeyboard, Link as PixelLink, Plus as PixelPlus, Video as PixelVideo } from 'pixelarticons/react';

type MeetingMode = 'later' | 'instant' | null;

// Spring for the New meeting pill <-> choices morph and the Join field beside it
const MORPH = { type: 'spring', stiffness: 420, damping: 36, mass: 0.8 } as const;

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
      <div className="relative flex-1 overflow-y-auto overflow-x-hidden">
        <EmberAurora />
        {/* Ember pixels on the border line only: a thin band at the top edge, part of
            the scrolling content so it leaves with the aurora */}
        <EmberPixels count={46} className="inset-x-0 top-0 z-[1] h-[14px]" drift={[0, 12]} sway={[-8, 8]} sizes={[3, 4, 4, 6]} />

        {/* Hero: centered headline, two actions, product mockup below */}
        <section className="relative z-20 mx-auto flex max-w-4xl flex-col items-center px-4 pt-12 text-center sm:pt-16">
          <h1 className="font-pixel text-[34px] font-normal leading-[1.1] tracking-[-0.01em] text-[#27272a] [-webkit-text-stroke:0.008em_currentColor] [text-wrap:balance] sm:text-5xl lg:text-[60px]">
            Talk the way you talk.
            <br />
            We&apos;ll catch <GlowWord>every word</GlowWord>.
          </h1>

          <p className="mt-5 max-w-md font-serif text-lg leading-relaxed text-ink-muted sm:text-xl">
            Video calls with live captions that keep up with how you actually talk, anywhere, with anyone.
          </p>

          <LayoutGroup>
          <div className="mt-9 flex w-full max-w-2xl flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            {/* New meeting: the pill morphs (animated width) into two choices in place,
                so nothing floats over the mockup and nothing jumps */}
            <motion.div
              layout
              transition={MORPH}
              style={{ borderRadius: 9999 }}
              role="group"
              aria-label="New meeting"
              className="relative flex h-12 shrink-0 items-center overflow-hidden bg-ink text-white shadow-[0_8px_24px_-8px_rgba(22,22,24,0.5)]"
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {!showDropdown ? (
                  <motion.button
                    key="new"
                    onClick={() => setShowDropdown(true)}
                    aria-expanded={false}
                    initial={{ opacity: 0, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, filter: 'blur(4px)' }}
                    transition={{ duration: 0.18 }}
                    className="flex h-full w-full items-center justify-center gap-2 whitespace-nowrap px-6 text-[15px] font-medium transition-colors hover:bg-white/5"
                  >
                    <PixelPlus className="size-[18px]" />
                    New meeting
                  </motion.button>
                ) : (
                  <motion.div
                    key="choices"
                    initial={{ opacity: 0, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, filter: 'blur(4px)' }}
                    transition={{ duration: 0.2, delay: 0.05 }}
                    className="flex h-full w-full items-center gap-1 whitespace-nowrap p-1 text-[14px] font-medium"
                  >
                    <button onClick={() => openModal('instant')} className="flex h-full flex-1 items-center justify-center gap-1.5 rounded-full px-4 transition-colors hover:bg-white/10 sm:flex-none">
                      <PixelVideo className="size-4 text-[#fdba74]" />
                      Start now
                    </button>
                    <span className="h-5 w-px shrink-0 bg-white/15" />
                    <button onClick={() => openModal('later')} className="flex h-full flex-1 items-center justify-center gap-1.5 rounded-full px-4 transition-colors hover:bg-white/10 sm:flex-none">
                      <PixelLink className="size-4 text-[#fdba74]" />
                      Schedule
                    </button>
                    <button onClick={() => setShowDropdown(false)} aria-label="Close" className="flex size-10 shrink-0 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white">
                      <PixelClose className="size-4" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Join with a code or link */}
            <motion.div
              layout
              transition={MORPH}
              style={{ borderRadius: 9999 }}
              className="relative flex h-12 min-w-0 flex-1 items-center border border-black/10 bg-white/80 pl-4 pr-1 backdrop-blur transition-shadow focus-within:border-ember/60 focus-within:ring-4 focus-within:ring-ember/15"
            >
              <PixelKeyboard className="size-[18px] shrink-0 text-ink-muted" />
              <input
                type="text"
                placeholder="Enter a code or link"
                aria-label="Meeting code or link"
                value={linkOrCode}
                onChange={(e) => setLinkOrCode(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && linkOrCode && !isCheckingSchedule) joinMeeting(); }}
                className="h-full min-w-0 flex-1 bg-transparent px-3 text-[15px] text-ink outline-none placeholder:text-ink-muted"
              />
              <button
                onClick={joinMeeting}
                disabled={!linkOrCode || isCheckingSchedule}
                className={cn(
                  "flex h-10 items-center rounded-full px-5 text-[14px] font-semibold transition-colors",
                  linkOrCode && !isCheckingSchedule ? 'bg-ember text-white hover:bg-ember-deep' : 'cursor-not-allowed text-ink-muted'
                )}
              >
                {isCheckingSchedule ? <SpinnerGap size={18} className="animate-spin" /> : 'Join'}
              </button>
            </motion.div>
          </div>
          </LayoutGroup>
        </section>

        {/* Product shot: the call UI on a laptop, turned slightly left */}
        <section className="relative z-10 mt-12 px-4 pb-10 [overflow-y:clip] sm:mt-14">
          <HeroLaptopMockup />
        </section>
      </div>

      <AnimatePresence>
      {meetingMode && step <= 2 && (
        <CastTalkModal isOpen={!!meetingMode && step <= 2} onClose={() => { setMeetingMode(null); setStep(1); }}>
          {step <= 2 && (
            <>
              {/* Step indicator */}
              <div className="flex items-center gap-2 mb-2">
                <div className={cn("flex-1 h-1.5 rounded-full", step >= 1 ? "bg-[#f97316]" : "bg-slate-200")} />
                <div className={cn("flex-1 h-1.5 rounded-full", step >= 2 ? "bg-[#f97316]" : "bg-slate-200")} />
              </div>
              <div className="flex items-center gap-2 mb-6">
                <div className={cn("flex-1 text-[12px] font-medium text-left", step >= 1 ? "text-[#9a3412]" : "text-slate-400")}>
                  Session
                </div>
                <div className={cn("flex-1 text-[12px] font-medium text-left", step >= 2 ? "text-[#9a3412]" : "text-slate-400")}>
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
                  <h2 className="font-pixel text-[22px] font-normal text-ink leading-none mb-1.5">
                    Select Meeting Type
                  </h2>
                  <p className="font-serif text-[15px] text-ink-muted" style={{ marginBottom: '10px' }}>
                    Select the type of meeting you want to create.
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <label
                    className={cn(
                      "flex items-start gap-3.5 p-3 rounded-xl cursor-pointer transition-all border border-transparent",
                      meetingType === 'general' ? "bg-orange-50 border-orange-200" : "hover:bg-slate-50"
                    )}
                    onClick={() => setMeetingType('general')}
                  >
                    <div className="mt-0.5">
                      <div className={cn(
                        "w-5 h-5 rounded-full border-[2px] flex items-center justify-center transition-colors",
                        meetingType === 'general' ? "border-orange-600" : "border-slate-300"
                      )}>
                        {meetingType === 'general' && <div className="w-2.5 h-2.5 rounded-full bg-orange-600" />}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Globe weight="fill" className={cn("w-4 h-4", meetingType === 'general' ? "text-orange-600" : "text-slate-500")} />
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
                  <h2 className="font-pixel text-[22px] font-normal text-ink leading-none mb-1.5">
                    {"What's your meeting about?"}
                  </h2>
                  <p className="font-serif text-[15px] text-ink-muted" style={{ marginBottom: '20px' }}>
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
                                '--rdp-accent-color': '#f97316',
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
                  className="px-5 py-2.5 rounded-full text-[14px] font-semibold hover:bg-[#F9FAFB] transition-colors text-[#374151] border border-[#E5E7EB] hover:border-[#D1D5DB] shadow-sm bg-white"
                >
                  Cancel
                </button>
              </div>
              <div className="flex gap-3">
                {step > 1 && (
                  <button
                    onClick={() => setStep(1)}
                    className="px-5 py-2.5 rounded-full text-[14px] font-semibold bg-[#f97316]/10 text-[#9a3412] hover:bg-[#f97316]/15 transition-colors"
                  >
                    Back
                  </button>
                )}
                <button
                  onClick={step === 2 ? () => handleSubmit(false) : () => setStep(2)}
                  disabled={isCreating || (step === 2 && !formTitle.trim())}
                  className="px-6 py-2.5 rounded-full text-[14px] font-semibold hover:bg-[#3f3f46] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-sm bg-[#161618]"
                >
                  {step === 2 ? (isCreating ? 'Creating...' : 'Create Event') : 'Next'}
                </button>
              </div>
            </div>
          )}
        </CastTalkModal>
      )}
      </AnimatePresence>

      {/* Step 3: Meeting Conflict — separate compact modal, sizes to content */}
      <AnimatePresence>
      {meetingMode && step === 3 && (
        <CastTalkModal isOpen={step === 3} onClose={() => { setMeetingMode(null); setStep(1); }} maxWidth="max-w-[460px]">
          <div className="flex flex-col font-geist">
            {/* Title */}
            <h2 className="font-pixel text-[20px] font-normal text-ink leading-tight font-geist mb-2">
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
                className="px-5 py-2.5 rounded-full text-[14px] font-semibold hover:bg-[#F9FAFB] transition-colors text-[#374151] border border-[#E5E7EB] hover:border-[#D1D5DB] shadow-sm bg-white font-geist"
              >
                Back
              </button>
              <button
                onClick={() => handleSubmit(true)}
                className="bg-[#161618] hover:bg-[#3f3f46] text-white text-[14px] font-bold px-6 py-2.5 rounded-xl transition-all active:scale-[0.98] font-geist"
              >
                Continue
              </button>
            </div>
          </div>
        </CastTalkModal>
      )}
      </AnimatePresence>

      <AnimatePresence>
      {meetingLink && (
        <CastTalkModal isOpen onClose={() => setMeetingLink(null)} maxWidth="max-w-md">
          <h2 className="mb-1.5 pr-16 font-pixel text-xl font-normal text-ink">Your meeting is ready</h2>
          <p className="mb-6 font-serif text-[15px] text-ink-muted">Share this link with people you want to meet with.</p>
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-black/10 bg-paper px-4 py-3">
            <span className="flex-1 truncate font-mono text-[13px] text-ink-soft">{meetingLink}</span>
            <button
              onClick={async () => { await navigator.clipboard.writeText(meetingLink!); toast({ title: 'Link copied!' }); }}
              className="flex shrink-0 items-center justify-center rounded-md p-1.5 text-ink-muted transition-colors hover:bg-ember/10 hover:text-ember-deep active:scale-95"
              title="Copy link"
              aria-label="Copy link"
            >
              <Copy size={18} />
            </button>
          </div>
          <button
            onClick={() => setMeetingLink(null)}
            className="w-full rounded-full bg-ink py-3 font-medium text-white transition-colors hover:bg-ink-soft"
          >
            Done
          </button>
        </CastTalkModal>
      )}
      </AnimatePresence>

      {/* Scheduled Meeting Join Modal */}
      <AnimatePresence>
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
            <h2 className="font-pixel text-[20px] font-normal text-ink leading-none mb-2.5">
              Scheduled Meeting
            </h2>
            <p className="text-[14px] text-slate-500 leading-relaxed mb-6">
              &ldquo;{scheduledMeetingInfo.title}&rdquo; is scheduled for {new Date(scheduledMeetingInfo.startsAt).toLocaleString('en-US', {
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
                className="px-5 py-2.5 rounded-full text-[14px] font-semibold hover:bg-[#F9FAFB] transition-colors text-[#374151] border border-[#E5E7EB] hover:border-[#D1D5DB] shadow-sm bg-white"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleAddToCalendar}
                disabled={isJoining}
                className="bg-[#161618] hover:bg-[#3f3f46] text-white text-[14px] font-bold px-6 py-2.5 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 shadow-sm"
              >
                {isJoining ? 'Adding...' : 'Add to calendar'}
              </button>
            </div>
          </div>
        </CastTalkModal>
      )}
      </AnimatePresence>

      {/* Meeting Not Started Warning Modal */}
      <AnimatePresence>
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
            <h2 className="font-pixel text-[20px] font-normal text-ink leading-none mb-2.5">
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
                className="bg-[#161618] hover:bg-[#3f3f46] text-white text-[14px] font-bold px-6 py-2.5 rounded-xl transition-all active:scale-[0.98] shadow-sm"
              >
                Back to Home
              </button>
            </div>
          </div>
        </CastTalkModal>
      )}
      </AnimatePresence>
    </>
  );
};

export default Home;
