'use client';
import React, { useState, useEffect, useRef } from 'react';
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
  PhoneDisconnect, Info, Copy, ChatCircle, Sparkle, ShieldWarning, DotsThree,
  MagnifyingGlass, UserPlus, Crown, ShieldCheck, PushPin, X
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

import Loader from './Loader';
import { cn } from '@/lib/utils';
import { NoiseTexture } from '@/components/ui/noise-texture';
import { Ripple } from './ui/ripple';

// RGB to HSL conversion
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
  setIsAllMuted
}: { 
  onClose: () => void; 
  participants: any[]; 
  userRoles: Record<string, string>; 
  setUserRoles: React.Dispatch<React.SetStateAction<Record<string, string>>>; 
  call: any;
  toast: any;
  isAllMuted: boolean;
  setIsAllMuted: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isContributorsOpen, setIsContributorsOpen] = useState(true);

  const filteredParticipants = participants.filter((p) => {
    const name = p.name || 'Participant';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleMuteAll = async () => {
    const nextState = !isAllMuted;
    setIsAllMuted(nextState);

    if (call) {
      try {
        await call.microphone.disable();
        await call.sendCustomEvent({ type: 'mute-all-users' });
        toast({ title: nextState ? "All participants muted" : "Mute all toggled" });
      } catch (e) {
        console.error(e);
        toast({ title: "All participants muted" });
      }
    }
  };

  const setRole = (userId: string, role: string) => {
    setUserRoles((prev) => ({ ...prev, [userId]: role }));
    toast({ title: `User role updated to ${role}` });
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#202124] text-white p-5 select-none overflow-hidden font-sans">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-medium tracking-tight text-white">People</h2>
        <button 
          onClick={onClose} 
          className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Action Button: Mute All */}
      <div className="mb-5">
        <button 
          onClick={handleMuteAll}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-full text-xs font-semibold transition-all shadow-sm",
            isAllMuted 
              ? "bg-[#ea4335] hover:bg-[#d93025] text-white" 
              : "bg-[#004a77] hover:bg-[#005999] text-[#c2e7ff]"
          )}
        >
          <MicrophoneSlash size={18} weight="bold" />
          <span>{isAllMuted ? 'All muted' : 'Mute all'}</span>
        </button>
      </div>

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
                const role = userRoles[p.userId] || (p.isLocal ? 'Meeting host' : 'Participant');

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
                        <span className="text-xs text-[#9aa0a6] truncate font-normal">
                          {role}
                        </span>
                      </div>
                    </div>

                    {/* Right actions: Audio status & Role Management menu */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Audio status indicator pill */}
                      <div className="size-8 rounded-full bg-[#a8c7fa]/20 text-[#a8c7fa] flex items-center justify-center">
                        <DotsThree size={16} weight="bold" />
                      </div>

                      {/* Options dropdown for Moderator / Admin role switching */}
                      <DropdownMenu>
                        <DropdownMenuTrigger className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors outline-none">
                          <DotsThreeVertical size={18} weight="bold" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-[#202124] border border-[#3c4043] text-white rounded-xl shadow-2xl min-w-[180px] p-1.5 z-50">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 py-1.5 border-b border-[#3c4043]/50 mb-1">
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
                          <DropdownMenuItem 
                            onClick={() => setRole(p.userId, 'Admin')}
                            className="flex items-center gap-2 cursor-pointer rounded-lg px-3 py-2 text-xs hover:bg-white/10 text-slate-200"
                          >
                            <Crown size={15} className="text-blue-400" />
                            <span>Set as Admin</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => setRole(p.userId, 'Participant')}
                            className="flex items-center gap-2 cursor-pointer rounded-lg px-3 py-2 text-xs hover:bg-white/10 text-slate-200"
                          >
                            <span>Set as Participant</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-[#3c4043]/50 my-1" />
                          <DropdownMenuItem 
                            onClick={() => toast({ title: `${displayName} pinned` })}
                            className="flex items-center gap-2 cursor-pointer rounded-lg px-3 py-2 text-xs hover:bg-white/10 text-slate-200"
                          >
                            <PushPin size={15} />
                            <span>Pin to screen</span>
                          </DropdownMenuItem>
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
  const [showParticipants, setShowParticipants] = useState(false);
  const [userRoles, setUserRoles] = useState<Record<string, string>>({});
  const [isAllMuted, setIsAllMuted] = useState(false);
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

  const handleAdmitUser = (targetUserId: string) => {
    if (!call) return;
    call.sendCustomEvent({ type: 'admit-user', targetUserId }).catch(console.error);
    setWaitingQueue((prev) => prev.filter((u) => u.userId !== targetUserId));
    toast({ title: 'Participant admitted' });
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
    toast({ title: 'All participants admitted' });
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

  // Listen to remote hand raise, mute-all, and admission request custom events
  useEffect(() => {
    if (!call) return;
    const unsubscribe = call.on('custom', (event: any) => {
      if (event?.custom?.type === 'request-admission' && isHost) {
        const { userId, userName, userImage } = event.custom;
        if (userId) {
          setWaitingQueue((prev) => {
            if (prev.some((u) => u.userId === userId)) return prev;
            return [...prev, { userId, userName: userName || 'Guest', userImage: userImage || '' }];
          });
        }
      } else if (event?.custom?.type === 'mute-all-users') {
        call.microphone.disable().catch(() => {});
        setIsAllMuted(true);
        toast({ title: "The host muted everyone" });
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
      }
    });
    return () => {
      unsubscribe();
    };
  }, [call, localParticipant?.userId, user?.id, isHost]);


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

  const springTransition = {
    type: 'spring' as const,
    stiffness: 220,
    damping: 26,
    mass: 0.8
  };

  const CallLayout = () => {
    const screenShareParticipant = participants.find(
      (p) => p.screenShareStream || (p as any).isScreenSharing || p.publishedTracks?.includes(3) || p.publishedTracks?.includes('SCREEN_SHARE' as any)
    ) || (isScreenSharing ? localParticipant : undefined);

    if ((hasOngoingScreenShare || isScreenSharing) && screenShareParticipant) {
      const presenterName = getParticipantHandName(screenShareParticipant);
      const sideCount = participants.length;

      const tileSideClass = "w-full aspect-video max-h-[220px] rounded-2xl overflow-hidden relative bg-[#202124] border border-white/5 shadow-md shrink-0";

      return (
        <div className="w-full h-full flex gap-4 p-4 min-h-0 bg-transparent relative z-10 justify-center">
          {/* Left side: Widescreen screen share presentation */}
          <motion.div 
            layout
            transition={springTransition}
            className="flex-[2.6] max-w-[70%] max-h-[calc(100vh-160px)] my-auto flex items-center justify-center relative bg-transparent h-full"
          >
            <ParticipantView 
              participant={screenShareParticipant} 
              trackType="screenShareTrack"
              VideoPlaceholder={CustomVideoFallback as any}
              className="w-full h-full str-video__video-fit-contain"
            />

            {/* Google Meet Presenting Badge */}
            <motion.div
              initial={{ y: 20, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              className="absolute bottom-4 left-4 z-30 flex items-center gap-2.5 bg-[#202124]/90 backdrop-blur-md border border-white/10 text-white px-3.5 py-2 rounded-full text-xs font-semibold shadow-xl select-none"
            >
              <div className="size-6 rounded-full bg-[#8ab4f8]/20 text-[#8ab4f8] flex items-center justify-center shrink-0">
                <Monitor size={15} weight="bold" />
              </div>
              <span className="text-white text-xs font-medium tracking-tight">
                {presenterName} is presenting
              </span>
            </motion.div>
          </motion.div>

          {/* Right side: Vertical grid of participants */}
          <div className="flex-[1] max-w-[27%] min-w-[220px] max-h-[calc(100vh-160px)] my-auto flex flex-col gap-3 shrink-0 overflow-y-auto pr-1 no-scrollbar">
            <AnimatePresence mode="popLayout">
              {participants.map((p) => (
                <motion.div 
                  key={p.sessionId} 
                  layout
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.85, opacity: 0 }}
                  whileHover={{ scale: 1.02 }}
                  transition={springTransition}
                  className={cn(tileSideClass, isHandUpForParticipant(p) && "hand-raised-active")}
                >
                  {(p.publishedTracks.includes(2) || p.publishedTracks.includes('VIDEO' as any)) ? (
                    <ParticipantView 
                      participant={p} 
                      VideoPlaceholder={CustomVideoFallback as any}
                      className="w-full h-full"
                    />
                  ) : (
                    <CustomVideoFallback participant={p} />
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

    const tileStyle = "aspect-video rounded-2xl overflow-hidden relative bg-[#202124] border border-white/5 shadow-2xl shrink-0";
    let tileClass = "";

    const count = participants.length;
    if (count === 1) {
      tileClass = "w-[88%] md:w-[62%] max-w-[840px] max-h-[calc(100vh-200px)] mx-auto";
    } else if (count === 2) {
      tileClass = "w-[88%] md:w-[45%] max-w-[620px] max-h-[calc(100vh-200px)]";
    } else if (count === 4) {
      tileClass = "w-[44%] md:w-[45%] max-w-[620px] max-h-[calc(100vh-200px)]";
    } else {
      tileClass = "w-[88%] md:w-[30%] max-w-[420px] max-h-[calc(100vh-200px)]";
    }

    return (
      <div className="w-full h-full flex items-center justify-center bg-transparent relative z-10 p-4">
        <div className="flex flex-wrap gap-4 items-center justify-center w-full max-h-[calc(100vh-160px)] overflow-y-auto no-scrollbar">
          <AnimatePresence mode="popLayout">
            {participants.map((p) => (
              <motion.div 
                key={p.sessionId} 
                layout
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
                whileHover={{ scale: 1.01 }}
                transition={springTransition}
                className={cn(tileStyle, tileClass, isHandUpForParticipant(p) && "hand-raised-active")}
              >
                {(p.publishedTracks.includes(2) || p.publishedTracks.includes('VIDEO' as any)) ? (
                  <ParticipantView 
                    participant={p} 
                    VideoPlaceholder={CustomVideoFallback as any}
                    className="w-full h-full"
                  />
                ) : (
                  <CustomVideoFallback participant={p} />
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

      {/* Floating Host Admission Queue Banner */}
      <AnimatePresence>

        {isHost && waitingQueue.length > 0 && (
          <motion.div
            initial={{ y: -60, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -60, opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-slate-900/95 text-white px-5 py-3 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-slate-700 overflow-hidden border border-white/20 flex items-center justify-center font-bold text-xs text-white uppercase shrink-0">
                  {waitingQueue[0].userImage ? (
                    <img src={waitingQueue[0].userImage} alt={waitingQueue[0].userName} className="w-full h-full object-cover" />
                  ) : (
                    waitingQueue[0].userName[0]
                  )}
                </div>
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full border-2 border-slate-900 animate-ping" />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-white">
                  {waitingQueue[0].userName} <span className="text-slate-400 font-normal">wants to join</span>
                </p>
                <p className="text-[10px] text-amber-400 font-medium">Private / Secure Meeting</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDenyUser(waitingQueue[0].userId)}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-medium transition-colors"
              >
                Deny
              </button>
              <button
                onClick={() => handleAdmitUser(waitingQueue[0].userId)}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors shadow-md"
              >
                Admit
              </button>
              {waitingQueue.length > 1 && (
                <button
                  onClick={handleAdmitAll}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors"
                >
                  Admit All ({waitingQueue.length})
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Left: Meeting Time & ID Info */}
      <div className="absolute top-6 left-6 z-20 flex items-center gap-3 text-white font-medium text-sm select-none">

        <span>{timeStr}</span>
        <span className="w-[1px] h-3.5 bg-[#3c4043]" />
        <span className="font-normal tracking-wide lowercase text-slate-300">{call?.id}</span>
        <Info size={16} className="text-slate-400 hover:text-white cursor-pointer ml-1" onClick={async () => {
          const url = typeof window !== 'undefined' ? `${window.location.origin}/meeting/${call?.id}` : '';
          await navigator.clipboard.writeText(url);
          toast({ title: 'Joining info copied!' });
        }} />
      </div>

      {/* Top Right: User avatar, count, sparkle */}
      <div className="absolute top-6 right-6 z-20 flex items-center gap-3">
        {/* Top Right Raised Hands Header Pill */}
        <AnimatePresence>
          {raisedHandCount > 0 && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0, x: 20 }}
              animate={{ scale: 1, opacity: 1, x: 0 }}
              exit={{ scale: 0.8, opacity: 0, x: 20 }}
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              onClick={() => setShowParticipants(true)}
              className="flex items-center gap-2 bg-[#6fd98b] text-[#04210c] pl-1.5 pr-3.5 py-1 rounded-full text-xs font-semibold shadow-md cursor-pointer hover:bg-[#5cdb87] transition-all select-none"
              title="View raised hands"
            >
              <div className="size-6 rounded-full bg-[#004f21] text-[#6fd98b] flex items-center justify-center shrink-0">
                <HandPalm size={14} weight="fill" />
              </div>
              <span className="font-semibold text-xs tracking-tight">
                {raisedHandCount === 1 ? raisedHandList[0].name : `${raisedHandCount} raised hands`}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Host Avatar / People Capsule */}
        <button 
          onClick={() => setShowParticipants((prev) => !prev)}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full transition-all bg-[#3c4043]/80 hover:bg-[#4a4f54]",
            showParticipants && "bg-[#8ab4f8]/20 text-[#8ab4f8] border border-[#8ab4f8]/30"
          )}
        >
          <div className="size-5 rounded-full bg-[#155724] text-white flex items-center justify-center text-[10px] uppercase font-bold">
            {call?.state.participants[0]?.name?.[0] || 'U'}
          </div>
          <span className="text-xs font-semibold text-white">
            {call?.state.participants.length || 1}
          </span>
        </button>
        {/* Sparkle icon (visual effects) */}
        <button 
          onClick={() => toast({ title: 'Visual effects are ready' })}
          className="p-2.5 bg-[#3c4043]/80 hover:bg-[#4a4f54] text-white rounded-full transition-colors flex items-center justify-center h-8 w-8"
          title="Apply visual effects"
        >
          <Sparkle size={15} weight="bold" />
        </button>
      </div>

      <div className="relative flex-1 min-h-0 max-h-[calc(100vh-110px)] flex items-center justify-center px-6 md:px-12 pt-14 pb-1 z-10 bg-transparent">
        <div className="flex w-full h-full min-h-0 items-center justify-center mx-auto rounded-lg overflow-hidden bg-transparent">
          {CallLayout()}
        </div>
        
        {/* 1:1 Replica Google Meet People Sidebar Panel */}
        <AnimatePresence>
          {showParticipants && (
            <motion.div
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="h-full ml-3 bg-[#202124] border border-[#3c4043] shadow-2xl rounded-2xl w-84 flex flex-col relative overflow-hidden shrink-0 z-30 select-none"
            >
              <GoogleMeetPeopleSidebar 
                onClose={() => setShowParticipants(false)}
                participants={participants}
                userRoles={userRoles}
                setUserRoles={setUserRoles}
                call={call}
                toast={toast}
                isAllMuted={isAllMuted}
                setIsAllMuted={setIsAllMuted}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* 3. Controls Area - Pinned All The Way Down to Absolute Bottom */}
      <div className="absolute bottom-4 left-0 right-0 w-full flex justify-between items-center px-8 z-30 bg-transparent select-none">
        {/* Bottom Left: Spacer (since time & code moved to top left) */}
        <div className="w-[240px]" />

        {/* Bottom Center: Google Meet Controls Dock */}
        <div className="flex items-center gap-3 relative">


          {/* Microphone Combined Pill */}
          <div className="flex items-center bg-[#3c4043] rounded-xl p-0.5 shadow-md border border-[#3c4043]/10">
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

          {/* Camera Combined Pill */}
          <div className="flex items-center bg-[#3c4043] rounded-xl p-0.5 shadow-md border border-[#3c4043]/10">
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

          {/* Present Now (Screen Share) */}
          <button
            onClick={toggleScreenShare}
            className={cn(
              "p-2 rounded-xl transition-colors flex items-center justify-center border shadow-md h-12 w-12",
              isScreenSharing ? "bg-[#a8c7fa] text-[#041e49] border-transparent hover:bg-[#b8d7fb]" : "bg-[#3c4043] text-white border-transparent hover:bg-[#4a4f54]"
            )}
            title="Present Now"
          >
            <ArrowSquareUp size={18} weight="bold" />
          </button>

          {/* CC Button */}
          <button
            onClick={() => setIsCcActive((prev) => !prev)}
            className={cn(
              "p-2 rounded-xl transition-colors flex items-center justify-center border shadow-md h-12 w-12",
              isCcActive ? "bg-[#a8c7fa] text-[#041e49] border-transparent hover:bg-[#b8d7fb]" : "bg-[#3c4043] text-white border-transparent hover:bg-[#4a4f54]"
            )}
            title="Toggle Captions"
          >
            <ClosedCaptioning size={18} weight="bold" />
          </button>

          {/* Raise Hand */}
          <button
            onClick={toggleHandRaise}
            className={cn(
              "p-2 rounded-xl transition-all flex items-center justify-center border shadow-md h-12 w-12",
              isHandRaised 
                ? "bg-[#6fd98b] text-[#04210c] hover:bg-[#5cdb87] border-transparent font-bold" 
                : "bg-[#3c4043] text-white border-transparent hover:bg-[#4a4f54]"
            )}
            title={isHandRaised ? "Lower Hand" : "Raise Hand"}
          >
            <HandPalm size={18} weight={isHandRaised ? "fill" : "bold"} />
          </button>

          {/* More Options */}
          <DropdownMenu>
            <DropdownMenuTrigger className="p-2 bg-[#3c4043] text-white hover:bg-[#4a4f54] rounded-xl transition-colors border border-transparent outline-none focus:outline-none shadow-md flex items-center justify-center h-12 w-12">
              <DotsThreeVertical size={18} weight="bold" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-[#202124] border border-[#3c4043] text-white rounded-xl shadow-2xl mb-4 min-w-[200px] p-1.5 z-50">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 py-1.5 border-b border-[#3c4043]/50 mb-1">Meeting Options</div>
              <DropdownMenuItem 
                onClick={() => toast({ title: 'Quality Stats is enabled' })}
                className="flex items-center gap-2 cursor-pointer rounded-lg px-3 py-2 text-xs hover:bg-white/5 text-slate-300"
              >
                <span>Call Statistics</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#3c4043]/50 my-0.5" />
              <DropdownMenuItem 
                onClick={() => toast({ title: 'Opening Troubleshooting...' })}
                className="flex items-center gap-2 cursor-pointer rounded-lg px-3 py-2 text-xs hover:bg-white/5 text-slate-300"
              >
                <span>Troubleshooting & Help</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Hangup button */}
          <button
            onClick={hangup}
            className="px-6 bg-[#ea4335] hover:bg-[#d93025] text-white rounded-xl transition-colors flex items-center justify-center shadow-lg active:scale-95 h-12"
            title="Leave Call"
          >
            <PhoneDisconnect size={18} weight="bold" />
          </button>
        </div>

        {/* Bottom Right: GMeet bottom right action icons */}
        <div className="flex items-center gap-3 w-[240px] justify-end">
          {/* Chat Icon */}
          <button 
            onClick={() => toast({ title: 'Chat is currently disabled in this room' })}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-[#3c4043] hover:bg-[#4a4f54] text-white transition-colors border border-transparent outline-none focus:outline-none shadow-md"
            title="Chat with everyone"
          >
            <ChatCircle weight="bold" size={18} />
          </button>



          {/* Host Lock Settings Icon */}
          <button 
            onClick={() => toast({ title: 'Host controls are open' })}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-[#3c4043] hover:bg-[#4a4f54] text-white transition-colors outline-none focus:outline-none shadow-md"
            title="Host controls"
          >
            <ShieldWarning weight="bold" size={18} />
          </button>
        </div>
      </div>
    </section>
  );
};

export default MeetingRoom;
