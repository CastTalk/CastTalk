'use client';
import React, { useState, useEffect } from 'react';
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
import { 
  Users, SquaresFour, GridFour, Monitor,
  CaretUp, Microphone, MicrophoneSlash, VideoCamera, VideoCameraSlash,
  ClosedCaptioning, ArrowSquareUp, HandPalm, DotsThreeVertical,
  PhoneDisconnect, Info, Copy, ChatCircle, Sparkle, ShieldWarning, DotsThree
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
            className="w-16 h-16 rounded-full object-cover relative z-10"
          />
        </div>
      ) : (
        <div className="w-16 h-16 rounded-full bg-white/10 text-white flex items-center justify-center text-2xl font-semibold relative z-10 uppercase">
          {initials}
        </div>
      )}
    </div>
  );
});
CustomVideoFallback.displayName = 'CustomVideoFallback';

type CallLayoutType = 'grid' | 'fullscreen';

const MeetingRoom = () => {
  const searchParams = useSearchParams();
  const isPersonalRoom = !!searchParams.get('personal');
  const router = useRouter();
  const [layout, setLayout] = useState<CallLayoutType>('grid');
  const [showParticipants, setShowParticipants] = useState(false);
  const { useCallCallingState, useCameraState, useMicrophoneState, useScreenShareState, useHasOngoingScreenShare, useLocalParticipant } = useCallStateHooks();
  const cameraState = useCameraState();
  const micState = useMicrophoneState();
  const screenShareState = useScreenShareState();
  const hasOngoingScreenShare = useHasOngoingScreenShare();
  const localParticipant = useLocalParticipant();
  const isMicMuted = micState.isMute;
  const isCameraMuted = cameraState.isMute;
  const isScreenSharing = !screenShareState.isMute;
  const call = useCall();
  const [timeStr, setTimeStr] = useState('');
  const [isCcActive, setIsCcActive] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const { toast } = useToast();

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
    } catch (e) {
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
    try {
      await call.leave();
      router.push('/');
      toast({ title: 'Left meeting room' });
    } catch (e) {
      console.error(e);
      router.push('/');
    }
  };

  const CallLayout = () => {
    const participants = call?.state.participants || [];
    const screenShareParticipant = participants.find((p) => p.screenShareStream);

    if (hasOngoingScreenShare && screenShareParticipant) {
      return (
        <div className="w-full h-full flex gap-4 p-4 min-h-0 bg-transparent relative z-10 justify-center">
          {/* Left side: Widescreen screen share presentation */}
          <div className="flex-[3] max-w-[75%] flex items-center justify-center relative overflow-hidden bg-[#202124] rounded-2xl border border-white/5 shadow-2xl">
            <ParticipantView 
              participant={screenShareParticipant} 
              trackType="screenShareTrack"
              VideoPlaceholder={CustomVideoFallback as any}
              className="w-full h-full str-video__video-fit-contain"
            />
          </div>

          {/* Right side: Vertical grid of participants (Google Meet sidebar layout) */}
          <div className="flex-[1] max-w-[23%] min-w-[200px] flex flex-col gap-3 shrink-0 overflow-y-auto pr-1">
            {participants.map((p) => (
              <div key={p.sessionId} className="aspect-video w-full rounded-2xl overflow-hidden relative bg-[#202124] border border-white/5 shadow-md shrink-0">
                <ParticipantView 
                  participant={p} 
                  VideoPlaceholder={CustomVideoFallback as any}
                  className="w-full h-full"
                />
              </div>
            ))}
          </div>
        </div>
      );
    }

    return <PaginatedGridLayout groupSize={9} VideoPlaceholder={CustomVideoFallback as any} />;
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
        .str-video__speaker-layout {
          background-color: transparent !important;
        }
        .str-video__video-fit-contain video {
          object-fit: contain !important;
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
        .str-video__participant-details {
          background: rgba(0, 0, 0, 0.5) !important;
          backdrop-filter: blur(4px) !important;
          border: 0.5px solid rgba(255, 255, 255, 0.15) !important;
          bottom: 12px !important;
          left: 12px !important;
          padding: 4px 8px !important;
          border-radius: 6px !important;
        }
        .str-video__participant-details__name {
          color: #ffffff !important;
          font-size: 11px !important;
          font-weight: 500 !important;
          text-shadow: none !important;
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
        [class*="connection-quality-indicator"],
        [class*="connection-quality"],
        [class*="connection-status"],
        [class*="connection-indicator"],
        [class*="participant-audio-state"],
        [class*="participant-video-state"],
        [class*="menu-button"] {
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

      <div className="relative flex-1 min-h-0 max-h-[calc(100vh-80px)] flex items-center justify-center p-2 pt-14 pb-2 z-10 bg-transparent">
        <div className="flex w-full h-full min-h-0 items-center justify-center mx-auto rounded-lg overflow-hidden bg-transparent">
          {CallLayout()}
        </div>
        
        {/* Participants Sidebar Panel (slides out dynamically resizing call layout) */}
        <div
          className={cn('h-full ml-3 bg-[#202124] border border-[#3c4043] shadow-2xl rounded-lg w-80 transition-all relative overflow-hidden', {
            'flex': showParticipants,
            'hidden': !showParticipants,
          })}
        >
          <div className="p-4 h-full w-full relative z-10 flex flex-col text-white">
            <CallParticipantsList onClose={() => setShowParticipants(false)} />
          </div>
        </div>
      </div>
      
      {/* 3. Controls Area - Full-Width Bottom Bar matching Google Meet Placement */}
      <div className="w-full h-20 flex justify-between items-center px-8 shrink-0 z-10 bg-transparent select-none">
        {/* Bottom Left: Spacer (since time & code moved to top left) */}
        <div className="w-[240px]" />

        {/* Bottom Center: Google Meet Controls Dock */}
        <div className="flex items-center gap-3 relative">


          {/* Microphone Combined Pill */}
          <div className="flex items-center bg-[#3c4043] rounded-xl p-0.5 shadow-md border border-[#3c4043]/10">
            <DropdownMenu>
              <DropdownMenuTrigger className={cn(
                "p-2.5 text-white rounded-l-xl outline-none focus:outline-none transition-colors border-r border-[#202124]/30",
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
                "p-2.5 rounded-r-xl transition-colors flex items-center justify-center min-w-[38px] h-[38px]",
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
                "p-2.5 text-white rounded-l-xl outline-none focus:outline-none transition-colors border-r border-[#202124]/30",
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
                "p-2.5 rounded-r-xl transition-colors flex items-center justify-center min-w-[38px] h-[38px]",
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
              "p-2.5 rounded-xl transition-colors flex items-center justify-center border shadow-md h-11 w-11",
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
              "p-2.5 rounded-xl transition-colors flex items-center justify-center border shadow-md h-11 w-11",
              isCcActive ? "bg-[#a8c7fa] text-[#041e49] border-transparent hover:bg-[#b8d7fb]" : "bg-[#3c4043] text-white border-transparent hover:bg-[#4a4f54]"
            )}
            title="Toggle Captions"
          >
            <ClosedCaptioning size={18} weight="bold" />
          </button>

          {/* Raise Hand */}
          <button
            onClick={() => {
              setIsHandRaised((prev) => !prev);
              if (!isHandRaised) {
                toast({ title: "You raised your hand" });
              }
            }}
            className={cn(
              "p-2.5 rounded-xl transition-colors flex items-center justify-center border shadow-md h-11 w-11",
              isHandRaised ? "bg-[#a8c7fa] text-[#041e49] border-transparent hover:bg-[#b8d7fb]" : "bg-[#3c4043] text-white border-transparent hover:bg-[#4a4f54]"
            )}
            title="Raise Hand"
          >
            <HandPalm size={18} weight="bold" />
          </button>

          {/* More Options */}
          <DropdownMenu>
            <DropdownMenuTrigger className="p-2.5 bg-[#3c4043] text-white hover:bg-[#4a4f54] rounded-xl transition-colors border border-transparent outline-none focus:outline-none shadow-md flex items-center justify-center h-11 w-11">
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
            className="px-6 py-2.5 bg-[#ea4335] hover:bg-[#d93025] text-white rounded-xl transition-colors flex items-center justify-center shadow-lg active:scale-95 h-11"
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
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#3c4043] hover:bg-[#4a4f54] text-white transition-colors border border-transparent outline-none focus:outline-none shadow-md"
            title="Chat with everyone"
          >
            <ChatCircle weight="bold" size={18} />
          </button>



          {/* Host Lock Settings Icon */}
          <button 
            onClick={() => toast({ title: 'Host controls are open' })}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#3c4043] hover:bg-[#4a4f54] text-white transition-colors outline-none focus:outline-none shadow-md"
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
