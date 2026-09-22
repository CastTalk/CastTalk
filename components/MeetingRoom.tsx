'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  CallParticipantsList,
  CallStatsButton,
  CallingState,
  PaginatedGridLayout,
  SpeakerLayout,
  useCallStateHooks,
  ToggleAudioPublishingButton,
  ToggleVideoPublishingButton,
  ScreenShareButton,
  useCall,
  ParticipantView,
} from '@stream-io/video-react-sdk';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, SquaresFour, GridFour, Monitor,
  CaretUp, CaretDown, Microphone, MicrophoneSlash, VideoCamera, VideoCameraSlash,
  ClosedCaptioning, ArrowSquareUp, HandPalm, DotsThreeVertical,
  Info, Copy, ChatCircle, Sparkle, ShieldWarning, DotsThree,
  MagnifyingGlass, UserPlus, Crown, ShieldCheck, PushPin, X, UserCircle
} from '@phosphor-icons/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { useToast } from '@/components/ui/use-toast';
import AcceptCall from '@/components/AcceptCall';

import Loader from './Loader';
import { cn } from '@/lib/utils';
import { NoiseTexture } from '@/components/ui/noise-texture';
import { Ripple } from './ui/ripple';
import { useTranscription } from '@/hooks/useTranscription';
import GoogleMeetTranscriptsSidebar, { TranscriptItem } from './GoogleMeetTranscriptsSidebar';
import GoogleMeetCastAISidebar from './GoogleMeetCastAISidebar';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h, s, l];
}

// HSL to hex conversion
function hslToHex(h: number, s: number, l: number): string {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s === 0) { r = g = b = l; } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  const toHex = (c: number) => Math.round(c * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Build a full palette from a single accent hex
function buildPalette(accent: string) {
  const r = parseInt(accent.slice(1, 3), 16);
  const g = parseInt(accent.slice(3, 5), 16);
  const b = parseInt(accent.slice(5, 7), 16);
  const [h, s, l] = rgbToHsl(r, g, b);

  const dark = hslToHex(h, s * 0.85, l * 0.75);
  const gR = Math.round(r * 0.7);
  const gG = Math.round(g * 0.7);
  const gB = Math.round(b * 0.7);

  return {
    accent,
    dark,
    glow: `rgba(${gR},${gG},${gB},.08)`,
  };
}

// Default fallback palette (dusty purple)
const DEFAULT_PALETTE = buildPalette('#6C4660');

// Custom video fallback mimicking Google Meet off-camera screen
const CustomVideoFallback = React.forwardRef<HTMLDivElement, { participant?: any }>((props, ref) => {
  const { participant } = props;
  const [palette, setPalette] = useState(DEFAULT_PALETTE);
  
  const initials = participant?.name?.[0] || 'U';

  // Extract dominant colorful accent from profile image
  useEffect(() => {
    if (!participant?.image) return;

    let isMounted = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = participant.image;

    img.onload = () => {
      try {
        const size = 20;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;

        // Only average COLORFUL pixels — skip greys, blacks, whites
        let hSum = 0, sSum = 0, lSum = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
          const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);

          // Skip: low saturation (grey/black clothing), too dark, too bright
          if (s < 0.15) continue;
          if (l < 0.15) continue;
          if (l > 0.92) continue;

          hSum += h;
          sSum += s;
          lSum += l;
          count++;
        }

        if (count < 5) return; // not enough colorful pixels, keep default

        if (!isMounted) return;
        const avgH = hSum / count;
        const avgS = sSum / count;
        const avgL = lSum / count;

        // Darken ~20%, desaturate ~15% → muted Meet-style tone
        const finalS = avgS * 0.85;
        const finalL = Math.min(avgL * 0.55, 0.38); // keep it dark like Meet

        const accent = hslToHex(avgH, finalS, finalL);
        setPalette(buildPalette(accent));
      } catch {
        // CORS error — keep default palette
      }
    };

    return () => {
      isMounted = false;
    };
  }, [participant?.image]);

  return (
    <div 
      ref={ref} 
      className="w-full h-full flex items-center justify-center relative overflow-hidden select-none"
      style={{ backgroundColor: palette.dark }}
    >
      {/* Layer 1: Flat gradient — same hue, subtle contrast */}
      <div 
        className="absolute inset-0 z-[1]"
        style={{
          background: `linear-gradient(90deg, ${palette.dark} 0%, ${palette.accent} 100%)`,
        }}
      />

      {/* Layer 2: Radial center glow — tinted */}
      <div 
        className="absolute inset-0 z-[2]"
        style={{
          background: `radial-gradient(circle at center, ${palette.glow} 0%, transparent 55%)`,
        }}
      />

      {/* Layer 3: Vignette — darker corners */}
      <div 
        className="absolute inset-0 z-[3]"
        style={{
          background: `radial-gradient(circle at center, transparent 40%, rgba(0,0,0,0.15) 100%)`,
        }}
      />

      {/* Layer 4: Film grain noise */}
      <NoiseTexture className="absolute inset-0 z-[4] opacity-[0.02] mix-blend-overlay pointer-events-none" />

      {/* Layer 5: Avatar (no shadow or back glow) */}
      {participant?.image ? (
        <div className="relative z-10">
          <img 
            src={participant.image} 
            alt={participant?.name || 'User'}
            className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full object-cover relative z-10"
          />
        </div>
      ) : (
        <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full bg-white/10 text-white flex items-center justify-center text-2xl md:text-3xl font-semibold relative z-10 uppercase">
          {initials}
        </div>
      )}
    </div>
  );
});
CustomVideoFallback.displayName = 'CustomVideoFallback';

// Global map to track pending call leave timeouts to prevent React StrictMode double-mount issues
// Animated Hand Raise Badge on Participant Tiles (Google Meet style)
const RaisedHandTileBadge = ({ name }: { name: string }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExpanded(true);
    }, 700); // 700ms initial pop-up delay before expanding name
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div
      initial={{ y: 24, opacity: 0, scale: 0.8 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 24, opacity: 0, scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 350, damping: 26 }}
      className="absolute bottom-3 left-3 z-30 flex items-center bg-[#6fd98b] text-[#04210c] rounded-full shadow-lg overflow-hidden h-8 px-2.5 select-none pointer-events-none"
    >
      <div className="flex items-center justify-center shrink-0">
        <HandPalm size={18} weight="fill" className="text-[#04210c]" />
      </div>
      <AnimatePresence>
        {isExpanded && (
          <motion.span
            initial={{ width: 0, opacity: 0, marginLeft: 0 }}
            animate={{ width: 'auto', opacity: 1, marginLeft: 6 }}
            exit={{ width: 0, opacity: 0, marginLeft: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="text-xs font-semibold whitespace-nowrap overflow-hidden pr-1 text-[#04210c]"
          >
            {name}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// Custom 1:1 Google Meet Replica People Sidebar Panel
const GoogleMeetPeopleSidebar = ({ 
  onClose, 
  participants, 
  userRoles, 
  setUserRoles, 
  call,
  toast,
  isAllMuted,
  setIsAllMuted,
  pinnedSessionId,
  setPinnedSessionId,
  isHost,
}: { 
  onClose: () => void; 
  participants: any[]; 
  userRoles: Record<string, string>; 
  setUserRoles: React.Dispatch<React.SetStateAction<Record<string, string>>>; 
  call: any;
  toast: any;
  isAllMuted: boolean;
  setIsAllMuted: React.Dispatch<React.SetStateAction<boolean>>;
  pinnedSessionId: string | null;
  setPinnedSessionId: React.Dispatch<React.SetStateAction<string | null>>;
  isHost?: boolean;
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isContributorsOpen, setIsContributorsOpen] = useState(true);

  const filteredParticipants = participants.filter((p) => {
    const name = p.name || 'Participant';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const localUser = participants.find((p) => p.isLocal);
  const hostUserId = call?.state?.createdBy?.id || (call?.state?.custom as any)?.createdBy;
  const isLocalHost = Boolean(
    isHost ||
    (localUser?.userId && hostUserId === localUser.userId) ||
    (call?.state?.createdBy?.id && localUser?.userId === call.state.createdBy.id)
  );

  const effectiveLocalRole = localUser?.userId ? userRoles[localUser.userId] : undefined;
  const currentUserRole = effectiveLocalRole || (isLocalHost ? 'Meeting host' : 'Participant');

  // Role permissions hierarchy:
  // 1. Host: Highest access, can assign roles, Mute All, and remove participants
  const canAssignRoles = isLocalHost || currentUserRole === 'Meeting host';
  // 2. Moderator & Host: Can remove participants from meeting
  const canRemoveParticipants = isLocalHost || currentUserRole === 'Meeting host' || currentUserRole === 'Moderator';
  // 3. Host only: Can Mute All
  const canMuteAll = isLocalHost || currentUserRole === 'Meeting host';

  const handleMuteAll = async () => {
    const nextState = !isAllMuted;
    setIsAllMuted(nextState);

    if (call) {
      try {
        if (nextState) {
          await call.sendCustomEvent({ type: 'mute-all-users' });
        } else {
          await call.sendCustomEvent({ type: 'unmute-all-users' });
        }
        toast({ title: nextState ? "Muted all participants (Spotlight exempted)" : "Unmuted all participants" });
      } catch (e) {
        console.error(e);
        toast({ title: "Action failed" });
      }
    }
  };

  const setRole = (userId: string, role: string) => {
    setUserRoles((prev) => {
      const updated = { ...prev, [userId]: role };
      if (call) {
        // 1. Sync directly to Stream call server state (persists & syncs automatically)
        call.update({ custom: { ...(call.state?.custom || {}), userRoles: updated } }).catch(() => {});
        // 2. Broadcast custom event for immediate instant delivery
        call.sendCustomEvent({
          type: 'set-user-role',
          targetUserId: userId,
          role: role,
          roles: updated,
        }).catch(console.error);
      }
      return updated;
    });
    toast({ title: `Role updated to ${role}` });
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#202124] text-white p-5 select-none overflow-hidden font-sans rounded-2xl border border-[#3c4043] shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-medium tracking-tight text-white">People</h2>
        <button 
          onClick={onClose} 
          className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          <X size={20} />
        </button>
      </div>

      {/* Action Button: Mute All (Visible exclusively to Host) */}
      {canMuteAll && (
        <div className="mb-5">
          <button 
            onClick={handleMuteAll}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-full text-xs font-semibold transition-all shadow-sm cursor-pointer",
              isAllMuted 
                ? "bg-[#ea4335] hover:bg-[#d93025] text-white" 
                : "bg-[#004a77] hover:bg-[#005999] text-[#c2e7ff]"
            )}
          >
            <MicrophoneSlash size={18} weight="bold" />
            <span>{isAllMuted ? 'Unmute all' : 'Mute all (Except Spotlight)'}</span>
          </button>
        </div>
      )}

      {/* Search Input */}
      <div className="relative flex items-center bg-[#1e1f21] border border-[#5f6368] focus-within:border-[#8ab4f8] rounded-xl px-3.5 py-2.5 mb-5 transition-colors">
        <MagnifyingGlass size={18} className="text-[#9aa0a6] mr-2.5 shrink-0" />
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for people"
          className="bg-transparent text-sm text-white placeholder-[#9aa0a6] outline-none w-full"
        />
      </div>

      {/* Section Sub-header */}
      <div className="text-[11px] font-bold tracking-wider text-[#9aa0a6] uppercase mb-2 px-1">
        In the meeting
      </div>

      {/* Contributors Accordion Card */}
      <div className="flex-1 overflow-y-auto pr-1 no-scrollbar flex flex-col gap-2">
        <div className="border border-[#3c4043] bg-[#28292c]/50 rounded-2xl overflow-hidden">
          {/* Card Title Header */}
          <div 
            onClick={() => setIsContributorsOpen(!isContributorsOpen)}
            className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors border-b border-[#3c4043]/40"
          >
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-white">Contributors</span>
              <span className="text-xs text-slate-400 font-medium">{filteredParticipants.length}</span>
            </div>
            {isContributorsOpen ? <CaretUp size={16} className="text-slate-400" /> : <CaretDown size={16} className="text-slate-400" />}
          </div>

          {/* Participant List */}
          {isContributorsOpen && (
            <div className="flex flex-col divide-y divide-[#3c4043]/30">
              {filteredParticipants.map((p) => {
                const displayName = p.name || 'Participant';
                const role = userRoles[p.userId] || (p.userId === hostUserId ? 'Meeting host' : 'Participant');
                const isSpotlight = role === 'Spotlight';

                return (
                  <div key={p.sessionId || p.userId} className="flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors">
                    {/* User info */}
                    <div className="flex items-center gap-3 min-w-0">
                      {p.image ? (
                        <img src={p.image} alt={displayName} className="size-9 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="size-9 rounded-full bg-[#155724] text-white flex items-center justify-center text-xs font-bold shrink-0 uppercase">
                          {displayName[0]}
                        </div>
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium text-white truncate">
                          {displayName} {p.isLocal ? '(You)' : ''}
                        </span>
                        <div className="text-xs truncate font-normal mt-0.5">
                          {role === 'Meeting host' ? (
                            <span className="text-amber-400 flex items-center gap-1 font-medium">
                              <Crown size={12} weight="fill" /> Meeting host
                            </span>
                          ) : role === 'Moderator' ? (
                            <span className="text-emerald-400 flex items-center gap-1 font-medium">
                              <ShieldCheck size={12} weight="fill" /> Moderator
                            </span>
                          ) : isSpotlight ? (
                            <span className="text-purple-400 flex items-center gap-1 font-medium">
                              <Sparkle size={12} weight="fill" /> Spotlight Presenter
                            </span>
                          ) : (
                            <span className="text-[#9aa0a6]">Participant</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right actions: Dropdown menu */}
                    <div className="flex items-center gap-2 shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors outline-none cursor-pointer">
                          <DotsThreeVertical size={18} weight="bold" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-[#202124] border border-[#3c4043] text-white rounded-xl shadow-2xl min-w-[200px] p-1.5 z-[120]">
                          {/* Pin Option for all attendees */}
                          <DropdownMenuItem 
                            onClick={() => setPinnedSessionId(pinnedSessionId === p.sessionId ? null : p.sessionId)}
                            className="flex items-center gap-2 cursor-pointer rounded-lg px-3 py-2 text-xs hover:bg-white/10 text-slate-200"
                          >
                            <PushPin size={15} className={pinnedSessionId === p.sessionId ? "text-blue-400" : ""} />
                            <span>{pinnedSessionId === p.sessionId ? 'Unpin from screen' : 'Pin to screen'}</span>
                          </DropdownMenuItem>

                          {/* Role Management (HOST ONLY) */}
                          {canAssignRoles && !p.isLocal && (
                            <>
                              <DropdownMenuSeparator className="bg-[#3c4043]/50 my-1" />
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 py-1.5">
                                Assign Role
                              </div>
                              
                              <DropdownMenuItem 
                                onClick={() => setRole(p.userId, 'Meeting host')}
                                className="flex items-center gap-2 cursor-pointer rounded-lg px-3 py-2 text-xs hover:bg-white/10 text-slate-200"
                              >
                                <Crown size={15} className="text-amber-400" />
                                <span>Set as Host</span>
                              </DropdownMenuItem>
                              
                              <DropdownMenuItem 
                                onClick={() => setRole(p.userId, 'Moderator')}
                                className="flex items-center gap-2 cursor-pointer rounded-lg px-3 py-2 text-xs hover:bg-white/10 text-slate-200"
                              >
                                <ShieldCheck size={15} className="text-emerald-400" />
                                <span>Set as Moderator</span>
                              </DropdownMenuItem>

                              {/* Spotlight toggle */}
                              <DropdownMenuItem 
                                onClick={() => setRole(p.userId, isSpotlight ? 'Participant' : 'Spotlight')}
                                className="flex items-center gap-2 cursor-pointer rounded-lg px-3 py-2 text-xs hover:bg-purple-500/15 text-purple-300"
                              >
                                <Sparkle size={15} className="text-purple-400" weight={isSpotlight ? "fill" : "bold"} />
                                <span>{isSpotlight ? 'Remove Spotlight' : 'Give Spotlight'}</span>
                              </DropdownMenuItem>
                              
                              <DropdownMenuItem 
                                onClick={() => setRole(p.userId, 'Participant')}
                                className="flex items-center gap-2 cursor-pointer rounded-lg px-3 py-2 text-xs hover:bg-white/10 text-slate-200"
                              >
                                <UserCircle size={15} className="text-slate-400" />
                                <span>Set as Participant</span>
                              </DropdownMenuItem>
                            </>
                          )}

                          {/* Moderator & Host Kick Option */}
                          {canRemoveParticipants && !p.isLocal && (
                            <>
                              <DropdownMenuSeparator className="bg-[#3c4043]/50 my-1" />
                              <DropdownMenuItem 
                                onClick={async () => {
                                  try {
                                    await call?.removeMembers([p.userId]);
                                    toast({ title: `${displayName} was removed` });
                                  } catch (e) {
                                    toast({ title: `Could not remove ${displayName}`, variant: 'destructive' });
                                  }
                                }}
                                className="flex items-center gap-2 cursor-pointer rounded-lg px-3 py-2 text-xs hover:bg-red-500/10 text-red-400"
                              >
                                <span className="font-semibold">Remove from meeting</span>
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const pendingLeaves = new Map<string, NodeJS.Timeout>();

type CallLayoutType = 'grid' | 'fullscreen';

const MeetingRoom = () => {
  const searchParams = useSearchParams();
  const isPersonalRoom = !!searchParams.get('personal');
  const router = useRouter();
  const { user } = useUser();
  const [layout, setLayout] = useState<CallLayoutType>('grid');
  const [activeSidebar, setActiveSidebar] = useState<'people' | 'transcripts' | 'ai' | null>(null);
  const showParticipants = activeSidebar === 'people';
  const isTranscriptsOpen = activeSidebar === 'transcripts';
  const isCastAIOpen = activeSidebar === 'ai';
  const [meetingTranscripts, setMeetingTranscripts] = useState<TranscriptItem[]>([]);
  const [remoteInterimText, setRemoteInterimText] = useState('');
  const [remoteInterimSpeaker, setRemoteInterimSpeaker] = useState('');
  const [userRoles, setUserRoles] = useState<Record<string, string>>({});
  const userRolesRef = useRef<Record<string, string>>(userRoles);
  useEffect(() => {
    userRolesRef.current = userRoles;
  }, [userRoles]);
  const [pinnedSessionId, setPinnedSessionId] = useState<string | null>(null);
  const [isAllMuted, setIsAllMuted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const { useCallCallingState, useCameraState, useMicrophoneState, useScreenShareState, useHasOngoingScreenShare, useLocalParticipant, useParticipants } = useCallStateHooks();
  const participants = useParticipants();
  const cameraState = useCameraState();
  const micState = useMicrophoneState();
  const screenShareState = useScreenShareState();
  const hasOngoingScreenShare = useHasOngoingScreenShare();
  const localParticipant = useLocalParticipant();
  const isMicMuted = micState.isMute;
  const isCameraMuted = cameraState.isMute;
  const isScreenSharing = !screenShareState.isMute;
  const call = useCall();
  const hostUserId = call?.state?.createdBy?.id || (call?.state?.custom as any)?.createdBy;
  const isHost = Boolean(user?.id && hostUserId === user.id);
  const [waitingQueue, setWaitingQueue] = useState<Array<{ userId: string; userName: string; userImage: string }>>([]);

  const [timeStr, setTimeStr] = useState('');
  const [isCcActive, setIsCcActive] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [raisedHandsMap, setRaisedHandsMap] = useState<Record<string, { name: string; timestamp: number }>>({});
  const { toast } = useToast();
  const hasLeftRef = useRef(false);

  // Active captions per participant profile tile: { [userId]: { speaker, text, timestamp } }
  const [activeCaptions, setActiveCaptions] = useState<
    Record<string, { speaker: string; text: string; timestamp: number }>
  >({});

  const customName = typeof window !== 'undefined' ? localStorage.getItem('streamDisplayName') : null;
  const currentUserId = localParticipant?.userId || user?.id || 'local-user';
  const displayName = localParticipant?.name || customName || user?.fullName || user?.firstName || 'Participant';

  const lastBroadcastRef = useRef(0);

  // Broadcast and locally display speech segment
  const handleTranscriptSegment = useCallback(
    (segment: { text: string; speaker: string; isPartial?: boolean }) => {
      // Ignore punctuation-only tokens like lone '.' or '...'
      if (!segment.text || !/[a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF]/.test(segment.text)) {
        return;
      }
      const now = Date.now();
      // 1. Display on local participant tile with 0ms instant latency
      setActiveCaptions((prev) => ({
        ...prev,
        [currentUserId]: {
          speaker: segment.speaker || displayName,
          text: segment.text,
          timestamp: now,
        },
      }));

      // 2. Add committed final segments to the meetingTranscripts list
      if (!segment.isPartial) {
        setMeetingTranscripts((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.userId === currentUserId && now - last.timestamp < 8000) {
            const next = [...prev];
            next[next.length - 1] = {
              ...last,
              text: `${last.text} ${segment.text}`,
              timestamp: now,
            };
            return next;
          }
          return [
            ...prev,
            {
              id: `t-${currentUserId}-${now}-${Math.random().toString(36).substring(2, 7)}`,
              userId: currentUserId,
              speaker: segment.speaker || displayName,
              text: segment.text,
              timestamp: now,
              avatar: user?.imageUrl || localParticipant?.image,
              isLocal: true,
            },
          ];
        });
      }

      // 3. Broadcast in real-time to all call participants via Stream custom event
      // Throttle partials to at most 1 every 120ms; finals send immediately
      if (call) {
        if (!segment.isPartial || now - lastBroadcastRef.current > 120) {
          lastBroadcastRef.current = now;
          call
            .sendCustomEvent({
              type: 'live-caption',
              userId: currentUserId,
              speaker: segment.speaker || displayName,
              text: segment.text,
              timestamp: now,
              isPartial: !!segment.isPartial,
            })
            .catch(() => {});
        }
      }
    },
    [call, currentUserId, displayName, user?.imageUrl, localParticipant?.image]
  );

  // — Speechmatics real-time transcription (Taglish) —
  const { 
    transcript: localTranscriptLines, 
    interimText, 
    isListening, 
    error: transcriptionError, 
    start: startTranscription, 
    stop: stopTranscription 
  } = useTranscription({
    onTranscript: handleTranscriptSegment,
  });

  const toggleTranscriptsSidebar = useCallback(() => {
    setActiveSidebar((prev) => {
      if (prev === 'transcripts') {
        return null;
      } else {
        if (!isCcActive) {
          setIsCcActive(true);
        }
        return 'transcripts';
      }
    });
  }, [isCcActive]);

  const handleStartTranscriptionFromSidebar = useCallback(() => {
    setIsCcActive(true);
    if (!isMicMuted) {
      startTranscription(displayName);
    }
  }, [isMicMuted, displayName, startTranscription]);

  const handleStopTranscriptionFromSidebar = useCallback(() => {
    setIsCcActive(false);
    stopTranscription();
  }, [stopTranscription]);

  // Auto-clear remote interim speech after inactivity
  useEffect(() => {
    if (remoteInterimText) {
      const timer = setTimeout(() => {
        setRemoteInterimText('');
        setRemoteInterimSpeaker('');
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [remoteInterimText]);

  // Start/stop transcription when CC is toggled AND mic is unmuted
  // When muted in the call, microphone recording is completely halted for privacy & accuracy!
  useEffect(() => {
    if (isCcActive && !isMicMuted) {
      startTranscription(displayName);
    } else {
      stopTranscription();
    }
  }, [isCcActive, isMicMuted, displayName, startTranscription, stopTranscription]);

  // Alert on transcription errors
  useEffect(() => {
    if (transcriptionError && isCcActive) {
      toast({ title: 'Captions error', description: transcriptionError, variant: 'destructive' });
    }
  }, [transcriptionError, isCcActive, toast]);

  // Auto-hide captions after 4.5 seconds of silence
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setActiveCaptions((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const [uid, cap] of Object.entries(next)) {
          if (now - cap.timestamp > 4500) {
            delete next[uid];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 500);
    return () => clearInterval(timer);
  }, []);

  const toggleCc = () => setIsCcActive((prev) => !prev);

  // Sync userRoles from call state once available
  useEffect(() => {
    const roles = (call?.state?.custom as any)?.userRoles;
    if (roles && Object.keys(roles).length > 0) {
      setUserRoles(roles);
    }
  }, [call?.state?.custom]);

  const handleAdmitUser = (targetUserId: string) => {
    if (!call) return;
    call.sendCustomEvent({ type: 'admit-user', targetUserId }).catch(console.error);
    setWaitingQueue((prev) => prev.filter((u) => u.userId !== targetUserId));
  };

  const handleDenyUser = (targetUserId: string) => {
    if (!call) return;
    call.sendCustomEvent({ type: 'deny-user', targetUserId }).catch(console.error);
    setWaitingQueue((prev) => prev.filter((u) => u.userId !== targetUserId));
  };

  const handleAdmitAll = () => {
    if (!call) return;
    waitingQueue.forEach((u) => {
      call.sendCustomEvent({ type: 'admit-user', targetUserId: u.userId }).catch(console.error);
    });
    setWaitingQueue([]);
  };

  const playHandRaiseSound = () => {
    try {
      const audio = new Audio('/sounds/Hand-raise.mp3');
      audio.volume = 0.6;
      audio.play().catch(() => {});
    } catch {
      // Audio autoplay policy fallback
    }
  };

  // Sync hand raise changes locally and over Stream custom events
  const toggleHandRaise = async () => {
    const nextState = !isHandRaised;
    setIsHandRaised(nextState);

    const customName = typeof window !== 'undefined' ? localStorage.getItem('streamDisplayName') : null;
    const displayName = localParticipant?.name || customName || user?.fullName || 'Participant';
    const userId = localParticipant?.userId || user?.id || 'local-user';

    if (nextState) {
      playHandRaiseSound();
    }

    setRaisedHandsMap((prev) => {
      const copy = { ...prev };
      if (nextState) {
        copy[userId] = { name: displayName, timestamp: Date.now() };
      } else {
        delete copy[userId];
      }
      return copy;
    });

    if (call) {
      try {
        await call.sendCustomEvent({
          type: 'hand-raise',
          isRaised: nextState,
          userId,
          name: displayName,
        });
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Listen to remote hand raise, mute-all, role updates, and admission request custom events
  useEffect(() => {
    if (!call) return;
    const currentUserId = localParticipant?.userId || user?.id || 'local-user';

    // 1. Initial check of call.state.custom roles
    if ((call.state.custom as any)?.userRoles) {
      setUserRoles((prev) => ({ ...prev, ...(call.state.custom as any).userRoles }));
    }

    // 2. Request current roles from host on mount as fallback
    call.sendCustomEvent({ type: 'request-roles' }).catch(() => {});

    // 3. Listen to persistent metadata updates from Stream server
    const unsubscribeCallUpdated = call.on('call.updated', (event: any) => {
      const serverRoles = (call.state.custom as any)?.userRoles || event?.call?.custom?.userRoles;
      if (serverRoles) {
        setUserRoles((prev) => ({ ...prev, ...serverRoles }));
      }
    });

    const unsubscribeCustom = call.on('custom', (event: any) => {
      if (event?.custom?.type === 'request-admission' && isHost) {
        const { userId, userName, userImage } = event.custom || {};
        const effectiveId = userId || (userName ? `user_${userName}` : '');
        if (effectiveId && effectiveId !== user?.id) {
          setWaitingQueue((prev) => {
            const existingIndex = prev.findIndex(
              (u) => u.userId === effectiveId || (userName && u.userName === userName)
            );
            if (existingIndex !== -1) {
              const updated = [...prev];
              updated[existingIndex] = {
                userId: effectiveId,
                userName: userName || prev[existingIndex].userName || 'Guest',
                userImage: userImage || prev[existingIndex].userImage || '',
              };
              return updated;
            }
            return [
              ...prev,
              { userId: effectiveId, userName: userName || 'Guest', userImage: userImage || '' },
            ];
          });
        }
      } else if (event?.custom?.type === 'set-user-role') {
        const { targetUserId, role, roles } = event.custom || {};
        if (roles) {
          setUserRoles((prev) => ({ ...prev, ...roles }));
        } else if (targetUserId && role) {
          setUserRoles((prev) => ({ ...prev, [targetUserId]: role }));
        }
        if (targetUserId === currentUserId) {
          if (role === 'Spotlight') {
            toast({ 
              title: "🌟 Spotlight Presenter Active", 
              description: "You have been given Spotlight privilege! Your mic is immune to Mute All."
            });
          } else {
            toast({ title: `Your role is now: ${role}` });
          }
        }
      } else if (event?.custom?.type === 'request-roles' && isHost) {
        call.sendCustomEvent({
          type: 'sync-roles',
          roles: userRolesRef.current,
        }).catch(console.error);
      } else if (event?.custom?.type === 'sync-roles') {
        if (event.custom?.roles) {
          setUserRoles((prev) => ({ ...prev, ...event.custom.roles }));
        }
      } else if (event?.custom?.type === 'mute-all-users') {
        const myEffectiveRole = userRolesRef.current[currentUserId] || (isHost ? 'Meeting host' : 'Participant');
        const isImmune = isHost || myEffectiveRole === 'Meeting host' || myEffectiveRole === 'Spotlight';

        if (isImmune) {
          toast({ 
            title: "Microphone Active (Spotlight / Host)", 
            description: "You are immune to Mute All as the presenter/host." 
          });
        } else {
          call.microphone.disable().catch(() => {});
          setIsAllMuted(true);
          toast({ title: "The host muted everyone (Spotlight presenter active)" });
        }
      } else if (event?.custom?.type === 'unmute-all-users') {
        setIsAllMuted(false);
        toast({ title: "Microphone restrictions cleared by host" });
      } else if (event?.custom?.type === 'hand-raise') {
        const { isRaised, userId, name } = event.custom;
        if (!userId) return;
        const currentLocalId = localParticipant?.userId || user?.id || 'local-user';
        if (isRaised && userId !== currentLocalId) {
          playHandRaiseSound();
        }
        setRaisedHandsMap((prev) => {
          const copy = { ...prev };
          if (isRaised) {
            copy[userId] = { name: name || 'Participant', timestamp: Date.now() };
          } else {
            delete copy[userId];
          }
          return copy;
        });
      } else if (event?.custom?.type === 'live-caption') {
        const { userId, speaker, text, timestamp, isPartial } = event.custom || {};
        if (userId && text && /[a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF]/.test(text)) {
          setActiveCaptions((prev) => ({
            ...prev,
            [userId]: {
              speaker: speaker || 'Participant',
              text,
              timestamp: timestamp || Date.now(),
            },
          }));

          if (isPartial) {
            setRemoteInterimText(text);
            setRemoteInterimSpeaker(speaker || 'Participant');
          } else {
            setRemoteInterimText('');
            setRemoteInterimSpeaker('');
            const remoteP = participants.find((p) => p.userId === userId);
            const eventTime = timestamp || Date.now();
            setMeetingTranscripts((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.userId === userId && eventTime - last.timestamp < 8000) {
                const next = [...prev];
                next[next.length - 1] = {
                  ...last,
                  text: `${last.text} ${text}`,
                  timestamp: eventTime,
                };
                return next;
              }
              return [
                ...prev,
                {
                  id: `t-${userId}-${eventTime}-${Math.random().toString(36).substring(2, 7)}`,
                  userId,
                  speaker: speaker || remoteP?.name || 'Participant',
                  text,
                  timestamp: eventTime,
                  avatar: remoteP?.image,
                  isLocal: false,
                },
              ];
            });
          }
        }
      }
    });

    return () => {
      unsubscribeCallUpdated();
      unsubscribeCustom();
    };
  }, [call, localParticipant?.userId, user?.id, isHost]);

  // Auto-prune already joined participants or host from waiting queue
  useEffect(() => {
    setWaitingQueue((prev) =>
      prev.filter(
        (u) =>
          u.userId !== user?.id &&
          !participants.some(
            (p) => p.userId === u.userId || (p.name && p.name === u.userName)
          )
      )
    );
  }, [participants, user?.id]);


  const raisedHandList = Object.entries(raisedHandsMap).map(([id, data]) => ({ userId: id, ...data }));
  const raisedHandCount = raisedHandList.length;

  const getParticipantHandName = (p: any) => {
    if (raisedHandsMap[p.userId]?.name) return raisedHandsMap[p.userId].name;
    if (p.isLocal) {
      const customName = typeof window !== 'undefined' ? localStorage.getItem('streamDisplayName') : null;
      return p.name || customName || user?.fullName || 'Participant';
    }
    return p.name || 'Participant';
  };

  const isHandUpForParticipant = (p: any) => {
    if (raisedHandsMap[p.userId]) return true;
    const localUserId = localParticipant?.userId || user?.id || 'local-user';
    if (p.isLocal && (raisedHandsMap[localUserId] || isHandRaised)) return true;
    return false;
  };

  useEffect(() => {
    const update = () => {
      const n = new Date();
      let h = n.getHours();
      const m = n.getMinutes().toString().padStart(2, '0');
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      setTimeStr(`${h}:${m} ${ampm}`);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);

  // Cancel any pending leaves when this call is actively rendered
  useEffect(() => {
    if (call?.id && pendingLeaves.has(call.id)) {
      clearTimeout(pendingLeaves.get(call.id)!);
      pendingLeaves.delete(call.id);
    }
  }, [call?.id]);

  // Automatically leave the call when the component unmounts (e.g. user navigates away)
  useEffect(() => {
    return () => {
      if (call && !hasLeftRef.current) {
        const timeoutId = setTimeout(() => {
          call.leave().catch(() => {});
          pendingLeaves.delete(call.id);
        }, 1500); // 1.5s buffer to allow StrictMode mount to cancel it
        pendingLeaves.set(call.id, timeoutId);
      }
    };
  }, [call]);

  useEffect(() => {
    // Dirty DOM hack: Stream's server caches user IDs for guests connecting via instant meetings.
    // This forcibly replaces long "user_*" IDs with the beautiful displayName from MeetingSetup localStorage.
    const customName = typeof window !== 'undefined' ? localStorage.getItem('streamDisplayName') : null;
    
    // Fallback if null, just call them Participant to remove ugliness
    const defaultName = customName || 'Participant';

    const interval = setInterval(() => {
      if (typeof document === 'undefined') return;
      const nameNodes = document.querySelectorAll('.str-video__participant-details__name');
      
      nameNodes.forEach(node => {
        const text = node.textContent?.trim() || '';
        // If it looks like a Stream autogenerated ID, or length is unusually long (> 20), replace it!
        if (text.startsWith('user_') || (text.length > 20 && !text.includes(' '))) {
          node.textContent = defaultName;
        }
      });
    }, 300); // Fast interval to prevent flickering

    return () => clearInterval(interval);
  }, []);

  // for more detail about types of CallingState see: https://getstream.io/video/docs/react/ui-cookbook/ringing-call/#incoming-call-panel
  const callingState = useCallCallingState();

  if (callingState !== CallingState.JOINED) return <Loader />;

  const toggleMic = async () => {
    if (!call) return;
    try {
      if (isMicMuted) {
        await call.microphone.enable();
      } else {
        await call.microphone.disable();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleCamera = async () => {
    if (!call) return;
    try {
      if (isCameraMuted) {
        await call.camera.enable();
      } else {
        await call.camera.disable();
      }
    } catch (e: any) {
      if (e?.name === 'NotReadableError') return;
      console.error(e);
    }
  };

  const toggleScreenShare = async () => {
    if (!call) return;
    try {
      await call.screenShare.toggle();
    } catch (e) {
      console.error(e);
    }
  };

  const hangup = async () => {
    if (!call) return;
    hasLeftRef.current = true;
    try {
      await call.leave();
      router.push('/');
      toast({ title: 'Left meeting room' });
    } catch (e) {
      console.error(e);
      router.push('/');
    }
  };

  const smoothTransition = {
    duration: 0.22,
    ease: [0.16, 1, 0.3, 1] as const,
  };

  const CallLayout = () => {
    const screenShareParticipant = participants.find(
      (p) => p.screenShareStream || (p as any).isScreenSharing || p.publishedTracks?.includes(3) || p.publishedTracks?.includes('SCREEN_SHARE' as any)
    ) || (isScreenSharing ? localParticipant : undefined);

    const pinnedParticipant = participants.find((p) => p.sessionId === pinnedSessionId);
    const activeMainParticipant = screenShareParticipant || pinnedParticipant;
    const isPinView = !!pinnedParticipant && !screenShareParticipant;

    if ((hasOngoingScreenShare || isScreenSharing || pinnedParticipant) && activeMainParticipant) {
      const presenterName = getParticipantHandName(activeMainParticipant);
      const sideCount = participants.length;

      const tileSideClass = "w-full aspect-video max-h-[220px] rounded-2xl overflow-hidden relative bg-[#202124] border border-white/5 shadow-md shrink-0";

      return (
        <div className="w-full h-full flex gap-4 p-4 min-h-0 bg-transparent relative z-10 justify-center">
          {/* Left side: Widescreen screen share or pinned video presentation */}
          <motion.div 
            layout="position"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={smoothTransition}
            className="flex-[2.6] max-w-[70%] max-h-[calc(100vh-160px)] my-auto flex items-center justify-center relative bg-transparent h-full"
          >
            <ParticipantView 
              participant={activeMainParticipant} 
              trackType={screenShareParticipant ? "screenShareTrack" : "videoTrack"}
              VideoPlaceholder={CustomVideoFallback as any}
              ParticipantViewUI={null}
              className="w-full h-full str-video__video-fit-contain"
            />

            {/* Google Meet Presenting / Pinned Badge */}
            <motion.div
              initial={{ y: 20, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              className="absolute bottom-4 left-4 z-30 flex items-center gap-2.5 bg-[#202124]/90 backdrop-blur-md border border-white/10 text-white px-3.5 py-2 rounded-full text-xs font-semibold shadow-xl select-none"
            >
              <div className="size-6 rounded-full bg-[#8ab4f8]/20 text-[#8ab4f8] flex items-center justify-center shrink-0">
                {screenShareParticipant ? (
                  <Monitor size={15} weight="bold" />
                ) : (
                  <PushPin size={15} weight="bold" />
                )}
              </div>
              <span className="text-white text-xs font-medium tracking-tight">
                {screenShareParticipant ? `${presenterName} is presenting` : `${presenterName} is pinned`}
              </span>
            </motion.div>

          </motion.div>

          {/* Right side: Vertical grid of participants */}
          <div className="flex-[1] max-w-[27%] min-w-[220px] max-h-[calc(100vh-160px)] my-auto flex flex-col gap-3 shrink-0 overflow-y-auto pr-1 no-scrollbar">
            <AnimatePresence mode="popLayout">
              {participants.filter(p => p.sessionId !== activeMainParticipant.sessionId).map((p) => (
                <motion.div 
                  key={p.sessionId} 
                  layout="position"
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  transition={smoothTransition}
                  className={cn(tileSideClass, isHandUpForParticipant(p) && "hand-raised-active")}
                >
                  {(p.publishedTracks.includes(2) || p.publishedTracks.includes('VIDEO' as any)) ? (
                    <ParticipantView 
                      participant={p} 
                      VideoPlaceholder={CustomVideoFallback as any}
                      ParticipantViewUI={null}
                      className="w-full h-full"
                    />
                  ) : (
                    <CustomVideoFallback participant={p} />
                  )}
                  {userRoles[p.userId] === 'Spotlight' && (
                    <div className="absolute top-2.5 left-2.5 z-30 flex items-center gap-1 bg-purple-600/90 text-white rounded-full px-2 py-0.5 text-[10px] font-bold shadow-md backdrop-blur-sm border border-purple-400/30 select-none pointer-events-none">
                      <Sparkle size={11} weight="fill" className="text-amber-300" />
                      <span>Spotlight</span>
                    </div>
                  )}
                  {!isHandUpForParticipant(p) && (
                    <div className="absolute bottom-3 left-3 z-20 text-white font-semibold text-xs tracking-tight pointer-events-none select-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                      {getParticipantHandName(p)}
                    </div>
                  )}
                  <AnimatePresence>
                    {isHandUpForParticipant(p) && (
                      <RaisedHandTileBadge name={getParticipantHandName(p)} />
                    )}
                  </AnimatePresence>

                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      );
    }

    const tileStyle = "rounded-2xl overflow-hidden relative bg-[#202124] border border-white/5 shadow-2xl shrink-0 transition-all";
    let tileClass = "";

    const count = participants.length;
    if (count === 1) {
      tileClass = activeSidebar && !isMobile
        ? "w-full sm:w-[96%] md:w-[92%] lg:w-[88%] max-w-[960px] max-h-[calc(100vh-160px)] aspect-video mr-0 sm:mr-1 ml-auto" 
        : "w-full sm:w-[88%] md:w-[62%] h-[55vh] sm:h-auto aspect-[4/3] sm:aspect-video max-w-[840px] max-h-[calc(100vh-160px)] mx-auto";
    } else if (count === 2) {
      tileClass = activeSidebar && !isMobile
        ? "w-full sm:w-[96%] md:w-[49%] aspect-[4/3] sm:aspect-video max-w-[620px] max-h-[calc(100vh-160px)]"
        : "w-full sm:w-[88%] md:w-[45%] h-[32vh] sm:h-auto aspect-[4/3] sm:aspect-video max-w-[620px] max-h-[calc(100vh-160px)]";
    } else if (count === 4) {
      tileClass = "w-[48%] md:w-[45%] aspect-[4/3] sm:aspect-video max-w-[620px] max-h-[calc(100vh-160px)]";
    } else {
      tileClass = "w-full sm:w-[48%] md:w-[30%] aspect-[4/3] sm:aspect-video max-w-[420px] max-h-[calc(100vh-160px)]";
    }

    return (
      <div className={cn("w-full h-full flex items-center justify-center bg-transparent relative z-10", activeSidebar && !isMobile ? "p-1 sm:p-2 pr-0 sm:pr-1" : "p-4")}>
        <div className={cn("flex flex-wrap items-center justify-center w-full max-h-[calc(100vh-160px)] overflow-y-auto no-scrollbar", activeSidebar && !isMobile ? "gap-2.5 sm:gap-3" : "gap-4")}>
          <AnimatePresence mode="popLayout">
            {participants.map((p) => (
              <motion.div 
                key={p.sessionId} 
                layout="position"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={smoothTransition}
                className={cn(tileStyle, tileClass, isHandUpForParticipant(p) && "hand-raised-active")}
              >
                {(p.publishedTracks.includes(2) || p.publishedTracks.includes('VIDEO' as any)) ? (
                  <ParticipantView 
                    participant={p} 
                    VideoPlaceholder={CustomVideoFallback as any}
                    ParticipantViewUI={null}
                    className="w-full h-full"
                  />
                ) : (
                  <CustomVideoFallback participant={p} />
                )}
                {userRoles[p.userId] === 'Spotlight' && (
                  <div className="absolute top-3 left-3 z-30 flex items-center gap-1.5 bg-purple-600/90 text-white rounded-full px-2.5 py-1 text-[11px] font-bold shadow-md backdrop-blur-sm border border-purple-400/30 select-none pointer-events-none">
                    <Sparkle size={12} weight="fill" className="text-amber-300" />
                    <span>Spotlight</span>
                  </div>
                )}
                {!isHandUpForParticipant(p) && (
                  <div className="absolute bottom-3 left-3 z-20 text-white font-semibold text-xs tracking-tight pointer-events-none select-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                    {getParticipantHandName(p)}
                  </div>
                )}
                <AnimatePresence>
                  {isHandUpForParticipant(p) && (
                    <RaisedHandTileBadge name={getParticipantHandName(p)} />
                  )}
                </AnimatePresence>

              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    );
  };

  return (
    <section className="h-screen w-full overflow-hidden bg-[#121212] text-white flex flex-col font-geist relative select-none">
      <style>{`
        /* Stream grid overrides to match Google Meet Dark Theme */
        .str-video__paginated-grid-layout {
          background-color: transparent !important;
          padding: 8px 16px !important;
          gap: 16px !important;
        }
        /* Hide floating details and menu buttons on screen share presentation track */
        .str-video__video-fit-contain .str-video__participant-details,
        .str-video__video-fit-contain .str-video__participant-menu-button,
        .str-video__video-fit-contain [class*="participant-details"],
        .str-video__video-fit-contain [class*="menu-button"] {
          display: none !important;
        }
        .str-video__speaker-layout {
          background-color: transparent !important;
        }
        .str-video__video-fit-contain {
          background-color: transparent !important;
          width: 100% !important;
          height: 100% !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
        .str-video__video-fit-contain video {
          object-fit: contain !important;
          max-width: 100% !important;
          max-height: 100% !important;
          width: auto !important;
          height: auto !important;
          background-color: transparent !important;
          border-radius: 16px !important;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4) !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
        }
        .str-video__participant-view {
          border-radius: 16px !important;
          overflow: hidden !important;
          background-color: transparent !important;
          border: none !important;
        }
        .str-video__participant-view > div {
          border-radius: 16px !important;
          overflow: hidden !important;
          border: 1px solid rgba(255, 255, 255, 0.04) !important;
          box-shadow: 0 4px 24px rgba(0,0,0,0.15) !important;
        }
        /* Specific rules for single user layout to widen it without breaking multi-user grid */
        .str-video__paginated-grid-layout--one .str-video__participant-view {
          max-width: 1140px !important;
          max-height: calc(100vh - 200px) !important;
          width: 95% !important;
          height: 80% !important;
          margin: auto !important;
        }
        .str-video__paginated-grid-layout__group {
          background-color: transparent !important;
          border: none !important;
        }
        .str-video__paginated-grid-layout--one {
          overflow: visible !important;
        }
        .str-video__speaker-layout .str-video__participant-view:not(.str-video__speaker-layout__participants-bar *) {
          max-width: 880px !important;
          max-height: calc(100vh - 200px) !important;
          width: 85% !important;
          height: 80% !important;
          margin: auto !important;
        }
        .str-video__participant-details,
        [class*="participant-details"],
        .str-video__participant-view__menu-button,
        .str-video__participant-menu-button,
        [class*="menu-button"] {
          display: none !important;
          opacity: 0 !important;
          visibility: hidden !important;
        }
        .str-video__participant-details__connection-status,
        .str-video__connection-quality-indicator,
        .str-video__participant-audio-state,
        .str-video__participant-video-state,
        .str-video__participant-view__menu-button,
        .str-video__participant-menu-button,
        .str-video__participant-details__mic-status,
        .str-video__participant-details__camera-status,
        .str-video__participant-details__connection-status-indicator,
        .str-video__connection-indicator,
        [class*="mic-status"],
        [class*="camera-status"],
        [class*="audio-state"],
        [class*="video-state"],
        [class*="connection-quality"],
        [class*="connection-status"],
        [class*="connection-indicator"],
        [class*="menu-button"],
        [class*="participant-details__mic"],
        [class*="participant-details__menu"],
        [class*="participant-details__pin"] {
          display: none !important;
        }
        
        /* Aggressively hide any menu toggle buttons or dropdowns */
        .str-video__participant-view *[aria-haspopup="menu"],
        .str-video__participant-view button[title="More options"],
        .str-video__menu-toggle-button,
        .str-video__participant-context-menu {
          display: none !important;
          opacity: 0 !important;
          visibility: hidden !important;
          pointer-events: none !important;
        }
        /* Sidebar styling */
        .str-video__participant-list-container {
          background-color: #202124 !important;
          border-color: #3c4043 !important;
          color: #ffffff !important;
        }
        .str-video__participant-list {
          background-color: #202124 !important;
          color: #ffffff !important;
        }
        .str-video__participant-list__title,
        .str-video__participant-list__close-button {
          color: #ffffff !important;
        }
        .str-video__participant-list__participant {
          border-bottom-color: #3c4043 !important;
          color: #ffffff !important;
        }
      `}</style>


      {/* Top Left: Meeting Time & ID Info */}
      <div className="absolute top-3 left-3 sm:top-6 sm:left-6 z-20 flex items-center gap-2 sm:gap-3 text-white font-medium text-xs sm:text-sm select-none">
        <span>{timeStr}</span>
        <span className="w-[1px] h-3.5 bg-[#3c4043]" />
        <span className="hidden sm:inline font-normal tracking-wide lowercase text-slate-300">{call?.id}</span>
        <span className="sm:hidden font-normal tracking-wide lowercase text-slate-300 max-w-[80px] truncate">{call?.id}</span>
        <Info size={16} className="text-slate-400 hover:text-white cursor-pointer ml-0.5 shrink-0" onClick={async () => {
          const url = typeof window !== 'undefined' ? `${window.location.origin}/meeting/${call?.id}` : '';
          await navigator.clipboard.writeText(url);
          toast({ title: 'Joining info copied!' });
        }} />
      </div>

      {/* Top Right: User avatar, count, sparkle */}
      <div className={cn(
        "absolute top-3 sm:top-6 z-20 flex items-center gap-2 sm:gap-3 transition-all duration-300",
        activeSidebar && !isMobile ? "right-[390px] sm:right-[405px]" : "right-3 sm:right-6"
      )}>



        {/* Admission Request Compact Pill (To the left of participants button) */}
        <AnimatePresence>
          {isHost && waitingQueue
            .filter((u) => u.userId !== user?.id)
            .filter(
              (u) => !participants.some((p) => p.userId === u.userId || (p.name && p.name === u.userName))
            )
            .filter(
              (u, index, self) =>
                self.findIndex(
                  (item) => item.userId === u.userId || (item.userName && item.userName === u.userName)
                ) === index
            )
            .map((user) => (
            <motion.div
              key={user.userId || user.userName}
              initial={{ scale: 0.85, opacity: 0, x: -20 }}
              animate={{ scale: 1, opacity: 1, x: 0 }}
              exit={{ scale: 0.85, opacity: 0, x: -20 }}
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              className="bg-[#202124] border border-[#3c4043] shadow-lg rounded-xl px-2.5 py-1 flex items-center gap-2.5 text-white h-10 select-none shrink-0"
            >
              <div className="flex items-center gap-2">
                {user.userImage ? (
                  <img src={user.userImage} alt={user.userName} className="size-6 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="size-6 rounded-full bg-[#155724] text-white flex items-center justify-center font-bold text-xs shrink-0">
                    {user.userName[0]?.toUpperCase() || 'U'}
                  </div>
                )}
                <div className="flex flex-col leading-tight max-w-[100px] sm:max-w-[130px]">
                  <span className="font-semibold text-xs truncate text-white">{user.userName}</span>
                  <span className="text-[10px] text-slate-400 truncate -mt-0.5">wants to join</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleDenyUser(user.userId)}
                  className="px-2.5 py-1 text-xs font-medium text-[#8ab4f8] hover:bg-[#8ab4f8]/10 rounded-lg transition-colors"
                >
                  Deny
                </button>
                <button
                  onClick={() => handleAdmitUser(user.userId)}
                  className="px-3 py-1 text-xs font-semibold bg-[#8ab4f8] text-[#202124] hover:bg-[#93baf9] rounded-lg transition-colors shadow-sm"
                >
                  Admit
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Host/Participant Overlapping Square Avatar Stack */}
        <button 
          onClick={() => setActiveSidebar((prev) => prev === 'people' ? null : 'people')}
          className={cn(
            "flex items-center gap-1.5 p-1 rounded-xl transition-all bg-[#3c4043] hover:bg-[#4a4f54] border border-transparent shadow-md select-none cursor-pointer",
            showParticipants && "bg-[#8ab4f8]/20 border-[#8ab4f8]/40"
          )}
          title="View participants"
        >
          <div className="flex items-center -space-x-2.5 overflow-hidden pl-0.5">
            {participants.slice(0, 4).map((p, index) => {
              const displayName = p.name || 'Participant';
              const imageUrl = p.image;
              const initial = displayName[0]?.toUpperCase() || 'U';

              return (
                <div
                  key={p.sessionId || p.userId || index}
                  className="relative size-7 rounded-lg overflow-hidden border-2 border-[#202124] bg-[#155724] text-white flex items-center justify-center font-bold text-[11px] shrink-0 shadow-sm"
                  style={{ zIndex: 10 - index }}
                >
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{initial}</span>
                  )}
                </div>
              );
            })}
          </div>
          <span className="text-xs font-bold text-white px-1.5">
            {participants.length || 1}
          </span>
        </button>

        {/* Sparkle icon (CastAI Assistant) */}
        <button 
          onClick={() => setActiveSidebar((prev) => prev === 'ai' ? null : 'ai')}
          className={cn(
            "h-10 w-10 rounded-xl transition-all flex items-center justify-center border shadow-md cursor-pointer",
            isCastAIOpen 
              ? "bg-[#8ab4f8]/20 text-[#8ab4f8] border-[#8ab4f8]/40" 
              : "bg-[#3c4043] hover:bg-[#4a4f54] text-white border-transparent"
          )}
          title={isCastAIOpen ? "Close CastAI Assistant" : "Open CastAI Assistant"}
        >
          <Sparkle size={18} weight={isCastAIOpen ? "fill" : "bold"} />
        </button>
      </div>

      <div className={cn(
        "relative flex-1 min-h-0 max-h-[calc(100vh-110px)] flex items-center justify-center pt-14 pb-1 z-10 bg-transparent w-full transition-all duration-300",
        activeSidebar && !isMobile ? "px-2 sm:px-3 md:px-4" : "px-3 sm:px-6 md:px-8"
      )}>
        <div className={cn(
          "flex flex-row w-full h-full min-h-0 items-center justify-center mx-auto rounded-lg overflow-hidden bg-transparent",
          activeSidebar && !isMobile ? "gap-2 sm:gap-2.5" : "gap-3 sm:gap-4"
        )}>
          {/* Main call video area that flex-resizes and shifts smoothly to the left on desktop */}
          <div className="flex-1 h-full min-w-0 flex items-center justify-center transition-all duration-300">
            {CallLayout()}
          </div>

          {/* Desktop Sidebar Area: In the SAME div without higher z-index overlay */}
          <AnimatePresence>
            {!isMobile && activeSidebar === 'transcripts' && (
              <motion.div
                key="sidebar-transcripts"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 380, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="hidden md:flex h-full shrink-0 overflow-hidden flex-col py-1"
              >
                <div className="w-[360px] sm:w-[380px] h-full">
                  <GoogleMeetTranscriptsSidebar 
                    onClose={() => setActiveSidebar(null)}
                    isListening={isListening}
                    isMicMuted={isMicMuted}
                    onStart={handleStartTranscriptionFromSidebar}
                    onStop={handleStopTranscriptionFromSidebar}
                    transcripts={meetingTranscripts}
                    interimText={interimText || remoteInterimText}
                    activeSpeakerName={interimText ? displayName : remoteInterimSpeaker}
                    localSpeakerName={displayName}
                    onOpenCastAI={() => setActiveSidebar('ai')}
                  />
                </div>
              </motion.div>
            )}

            {!isMobile && activeSidebar === 'ai' && (
              <motion.div
                key="sidebar-castai"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 380, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="hidden md:flex h-full shrink-0 overflow-hidden flex-col py-1"
              >
                <div className="w-[360px] sm:w-[380px] h-full">
                  <GoogleMeetCastAISidebar 
                    onClose={() => setActiveSidebar(null)}
                    transcripts={meetingTranscripts}
                    userName={displayName}
                    onOpenTranscripts={() => setActiveSidebar('transcripts')}
                  />
                </div>
              </motion.div>
            )}

            {!isMobile && activeSidebar === 'people' && (
              <motion.div
                key="sidebar-people"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 380, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="hidden md:flex h-full shrink-0 overflow-hidden flex-col py-1"
              >
                <div className="w-[360px] sm:w-[380px] h-full">
                  <GoogleMeetPeopleSidebar 
                    onClose={() => setActiveSidebar(null)}
                    participants={participants}
                    userRoles={userRoles}
                    setUserRoles={setUserRoles}
                    call={call}
                    toast={toast}
                    isAllMuted={isAllMuted}
                    setIsAllMuted={setIsAllMuted}
                    pinnedSessionId={pinnedSessionId}
                    setPinnedSessionId={setPinnedSessionId}
                    isHost={isHost}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Mobile Drawer for Transcripts and People */}
      <Drawer
        open={isMobile && Boolean(activeSidebar)}
        onOpenChange={(open) => {
          if (!open) setActiveSidebar(null);
        }}
      >
        <DrawerContent className="md:hidden bg-[#202124] border-t border-[#3c4043] text-white p-0 max-h-[85vh] rounded-t-2xl overflow-hidden focus:outline-none">
          <DrawerHeader className="sr-only">
            <DrawerTitle>
              {activeSidebar === 'transcripts' ? 'Transcripts' : activeSidebar === 'ai' ? 'CastAI Assistant' : 'People'}
            </DrawerTitle>
            <DrawerDescription>Meeting Panel</DrawerDescription>
          </DrawerHeader>

          <div className="h-[75vh] w-full overflow-hidden flex flex-col">
            {activeSidebar === 'transcripts' && (
              <GoogleMeetTranscriptsSidebar 
                onClose={() => setActiveSidebar(null)}
                isListening={isListening}
                isMicMuted={isMicMuted}
                onStart={handleStartTranscriptionFromSidebar}
                onStop={handleStopTranscriptionFromSidebar}
                transcripts={meetingTranscripts}
                interimText={interimText || remoteInterimText}
                activeSpeakerName={interimText ? displayName : remoteInterimSpeaker}
                localSpeakerName={displayName}
                onOpenCastAI={() => setActiveSidebar('ai')}
              />
            )}
            {activeSidebar === 'ai' && (
              <GoogleMeetCastAISidebar 
                onClose={() => setActiveSidebar(null)}
                transcripts={meetingTranscripts}
                userName={displayName}
                onOpenTranscripts={() => setActiveSidebar('transcripts')}
              />
            )}
            {activeSidebar === 'people' && (
              <GoogleMeetPeopleSidebar 
                onClose={() => setActiveSidebar(null)}
                participants={participants}
                userRoles={userRoles}
                setUserRoles={setUserRoles}
                call={call}
                toast={toast}
                isAllMuted={isAllMuted}
                setIsAllMuted={setIsAllMuted}
                pinnedSessionId={pinnedSessionId}
                setPinnedSessionId={setPinnedSessionId}
                isHost={isHost}
              />
            )}
          </div>
        </DrawerContent>
      </Drawer>
      
      {/* 3. Controls Area - Pinned All The Way Down to Absolute Bottom */}
      <div className="absolute bottom-2 sm:bottom-4 left-0 right-0 w-full flex justify-between items-center px-2 sm:px-8 z-30 bg-transparent select-none">
        {/* Bottom Left: Spacer (since time & code moved to top left) */}
        <div className="hidden md:block w-[240px]" />

        {/* Bottom Center: Google Meet Controls Dock */}
        <div className="flex items-center gap-2 sm:gap-3 relative mx-auto md:mx-0">

          {/* DESKTOP Microphone Combined Pill */}
          <div className="hidden md:flex items-center bg-[#3c4043] rounded-xl p-0.5 shadow-md border border-[#3c4043]/10">
            <DropdownMenu>
              <DropdownMenuTrigger className={cn(
                "p-2 text-white rounded-l-xl outline-none focus:outline-none transition-colors border-r border-[#202124]/30 h-[42px] flex items-center justify-center",
                isMicMuted ? "bg-[#5f2120] hover:bg-[#722726] rounded-l-xl" : "hover:bg-white/10"
              )}>
                <DotsThree size={16} weight="bold" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-[#202124] border border-[#3c4043] text-white rounded-xl shadow-2xl mb-4 min-w-[220px] p-1.5 z-50">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 py-1.5 border-b border-[#3c4043]/50 mb-1">Microphone</div>
                {micState.devices?.map((device) => {
                  const isSelected = micState.selectedDevice === device.deviceId;
                  return (
                    <DropdownMenuItem
                      key={device.deviceId}
                      className={cn(
                        "flex items-center gap-2 cursor-pointer rounded-lg px-3 py-2 text-xs transition-colors",
                        isSelected ? "bg-white/10 text-white font-bold" : "hover:bg-white/5 text-slate-355"
                      )}
                      onClick={() => call?.microphone.select(device.deviceId)}
                    >
                      <Microphone size={14} />
                      <span className="truncate">{device.label || 'Default Mic'}</span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              onClick={toggleMic}
              className={cn(
                "p-2 rounded-r-xl transition-colors flex items-center justify-center min-w-[42px] h-[42px]",
                isMicMuted ? "bg-[#ea4335] text-white hover:bg-[#f28b82] rounded-r-xl" : "text-white hover:bg-white/10"
              )}
            >
              {isMicMuted ? <MicrophoneSlash size={18} weight="bold" /> : <Microphone size={18} weight="bold" />}
            </button>
          </div>

          {/* MOBILE Microphone Single Button */}
          <button
            onClick={toggleMic}
            className={cn(
              "md:hidden size-11 rounded-2xl transition-colors flex items-center justify-center border shadow-md",
              isMicMuted ? "bg-[#ea4335] text-white border-transparent" : "bg-[#3c4043] text-white border-transparent"
            )}
            title={isMicMuted ? "Unmute Mic" : "Mute Mic"}
          >
            {isMicMuted ? <MicrophoneSlash size={18} weight="bold" /> : <Microphone size={18} weight="bold" />}
          </button>

          {/* DESKTOP Camera Combined Pill */}
          <div className="hidden md:flex items-center bg-[#3c4043] rounded-xl p-0.5 shadow-md border border-[#3c4043]/10">
            <DropdownMenu>
              <DropdownMenuTrigger className={cn(
                "p-2 text-white rounded-l-xl outline-none focus:outline-none transition-colors border-r border-[#202124]/30 h-[42px] flex items-center justify-center",
                isCameraMuted ? "bg-[#5f2120] hover:bg-[#722726] rounded-l-xl" : "hover:bg-white/10"
              )}>
                <CaretUp size={13} weight="bold" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-[#202124] border border-[#3c4043] text-white rounded-xl shadow-2xl mb-4 min-w-[220px] p-1.5 z-50">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 py-1.5 border-b border-[#3c4043]/50 mb-1">Camera</div>
                {cameraState.devices?.map((device) => {
                  const isSelected = cameraState.selectedDevice === device.deviceId;
                  return (
                    <DropdownMenuItem
                      key={device.deviceId}
                      className={cn(
                        "flex items-center gap-2 cursor-pointer rounded-lg px-3 py-2 text-xs transition-colors",
                        isSelected ? "bg-white/10 text-white font-bold" : "hover:bg-white/5 text-slate-355"
                      )}
                      onClick={() => call?.camera.select(device.deviceId)}
                    >
                      <VideoCamera size={14} />
                      <span className="truncate">{device.label || 'Default Camera'}</span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              onClick={toggleCamera}
              className={cn(
                "p-2 rounded-r-xl transition-colors flex items-center justify-center min-w-[42px] h-[42px]",
                isCameraMuted ? "bg-[#ea4335] text-white hover:bg-[#f28b82] rounded-r-xl" : "text-white hover:bg-white/10"
              )}
            >
              {isCameraMuted ? <VideoCameraSlash size={18} weight="bold" /> : <VideoCamera size={18} weight="bold" />}
            </button>
          </div>

          {/* MOBILE Camera Single Button */}
          <button
            onClick={toggleCamera}
            className={cn(
              "md:hidden size-11 rounded-2xl transition-colors flex items-center justify-center border shadow-md",
              isCameraMuted ? "bg-[#ea4335] text-white border-transparent" : "bg-[#3c4043] text-white border-transparent"
            )}
            title={isCameraMuted ? "Turn On Camera" : "Turn Off Camera"}
          >
            {isCameraMuted ? <VideoCameraSlash size={18} weight="bold" /> : <VideoCamera size={18} weight="bold" />}
          </button>

          {/* DESKTOP Transcribe / CC Combined Dual Pill */}
          <div className="hidden md:flex items-center bg-[#3c4043] rounded-xl p-0.5 shadow-md border border-[#3c4043]/10">
            {/* Left: Dynamic Arrow / Caret button to toggle the panel without starting transcription */}
            <button
              onClick={() => setActiveSidebar((prev) => prev === 'transcripts' ? null : 'transcripts')}
              className={cn(
                "p-2 text-white rounded-l-xl outline-none focus:outline-none transition-colors border-r border-[#202124]/30 h-[42px] min-w-[36px] flex items-center justify-center cursor-pointer",
                isTranscriptsOpen ? "bg-white/15 text-[#8ab4f8] rounded-l-xl" : "hover:bg-white/10 text-white"
              )}
              title={isTranscriptsOpen ? "Hide Transcripts Panel" : "Show Transcripts Panel"}
            >
              {isTranscriptsOpen ? (
                <CaretDown size={14} weight="bold" />
              ) : (
                <CaretUp size={14} weight="bold" />
              )}
            </button>

            {/* Right: CC Button to toggle voice recording */}
            <button
              onClick={() => {
                setIsCcActive((prev) => !prev);
              }}
              className={cn(
                "p-2 rounded-r-xl transition-colors flex items-center justify-center min-w-[42px] h-[42px] cursor-pointer",
                isCcActive 
                  ? "bg-[#a8c7fa] text-[#041e49] hover:bg-[#b8d7fb] rounded-r-xl font-bold" 
                  : "text-white hover:bg-white/10"
              )}
              title={isCcActive ? "Turn Off Captions & Transcription" : "Turn On Captions & Transcription"}
            >
              <ClosedCaptioning size={18} weight="bold" />
            </button>
          </div>

          {/* Present Now (Screen Share) */}
          <button
            onClick={toggleScreenShare}
            className={cn(
              "size-11 sm:size-12 rounded-2xl transition-colors flex items-center justify-center border shadow-md cursor-pointer",
              isScreenSharing ? "bg-[#a8c7fa] text-[#041e49] border-transparent hover:bg-[#b8d7fb]" : "bg-[#3c4043] text-white border-transparent hover:bg-[#4a4f54]"
            )}
            title="Present Now"
          >
            <ArrowSquareUp size={18} weight="bold" />
          </button>

          {/* Raise Hand */}
          <button
            onClick={toggleHandRaise}
            className={cn(
              "size-11 sm:size-12 rounded-2xl transition-all flex items-center justify-center border shadow-md",
              isHandRaised 
                ? "bg-[#6fd98b] text-[#04210c] hover:bg-[#5cdb87] border-transparent font-bold" 
                : "bg-[#3c4043] text-white border-transparent hover:bg-[#4a4f54]"
            )}
            title={isHandRaised ? "Lower Hand" : "Raise Hand"}
          >
            <HandPalm size={18} weight={isHandRaised ? "fill" : "bold"} />
          </button>

          {/* More Options Menu (Mobile Only - Hidden on Desktop) */}
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger className="size-11 rounded-2xl bg-[#3c4043] text-white hover:bg-[#4a4f54] transition-colors border border-transparent outline-none focus:outline-none shadow-md flex items-center justify-center">
                <DotsThreeVertical size={18} weight="bold" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-[#202124] border border-[#3c4043] text-white rounded-xl shadow-2xl mb-4 min-w-[210px] p-1.5 z-50 font-sans">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 py-1.5 border-b border-[#3c4043]/50 mb-1">Meeting Options</div>
                
                {/* Mobile-only options: CastAI, Transcripts, Captions */}
                <DropdownMenuItem 
                  onClick={() => setActiveSidebar((prev) => prev === 'ai' ? null : 'ai')}
                  className="flex items-center gap-3 cursor-pointer rounded-lg px-3 py-2 text-xs hover:bg-white/5 text-slate-200"
                >
                  <Sparkle size={16} weight="bold" className="text-[#8ab4f8]" />
                  <span>{isCastAIOpen ? 'Close CastAI' : 'Open CastAI'}</span>
                </DropdownMenuItem>

                <DropdownMenuItem 
                  onClick={() => setActiveSidebar((prev) => prev === 'transcripts' ? null : 'transcripts')}
                  className="flex items-center gap-3 cursor-pointer rounded-lg px-3 py-2 text-xs hover:bg-white/5 text-slate-200"
                >
                  <ClosedCaptioning size={16} weight="bold" />
                  <span>{isTranscriptsOpen ? 'Close Transcripts' : 'Open Transcripts'}</span>
                </DropdownMenuItem>

                <DropdownMenuItem 
                  onClick={() => setIsCcActive((prev) => !prev)}
                  className="flex items-center gap-3 cursor-pointer rounded-lg px-3 py-2 text-xs hover:bg-white/5 text-slate-200"
                >
                  <ClosedCaptioning size={16} weight="bold" />
                  <span>{isCcActive ? 'Turn Off Voice Transcription' : 'Turn On Voice Transcription'}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Hangup button */}
          <button
            onClick={hangup}
            className="size-11 sm:h-12 sm:px-6 bg-[#ea4335] hover:bg-[#d93025] text-white rounded-2xl transition-colors flex items-center justify-center shadow-lg active:scale-95 shrink-0"
            title="Leave Call"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-5 h-5 sm:w-6 sm:h-6 text-white shrink-0 pointer-events-none"
              aria-hidden="true"
            >
              <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
            </svg>
          </button>
        </div>

        {/* Bottom Right: Spacer (mirrors bottom left to keep center dock controls centered) */}
        <div className="hidden md:block w-[240px]" />
      </div>
    </section>
  );
};

export default MeetingRoom;
