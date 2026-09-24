'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  VideoPreview,
  useCall,
  useCallStateHooks,
} from '@stream-io/video-react-sdk';
import { Microphone, MicrophoneSlash, VideoCamera, VideoCameraSlash, Gear, PencilSimple, Check, Users, SpeakerSlash, Hourglass, Lock, ArrowLeft, Clock, SpinnerGap } from '@phosphor-icons/react';

import { useUser } from '@clerk/nextjs';
import { Ripple } from './ui/ripple';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';
import Alert from './Alert';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { NoiseTexture } from './ui/noise-texture';
import { useToast } from './ui/use-toast';

const DEVICE_PREFS_KEY = '@stream-io/device-preferences';

const DeviceSettingsPanel = () => {
  const call = useCall();
  const { useCameraState, useMicrophoneState, useSpeakerState } = useCallStateHooks();
  const { devices: cameras, selectedDevice: selectedCamera } = useCameraState();
  const { devices: mics, selectedDevice: selectedMic } = useMicrophoneState();
  const { devices: speakers, selectedDevice: selectedSpeaker } = useSpeakerState();
  const [activeTab, setActiveTab] = useState<'camera' | 'microphone' | 'speaker'>('camera');

  const updatePrefs = (patch: object) => {
    try {
      const existing = JSON.parse(localStorage.getItem(DEVICE_PREFS_KEY) || '{}');
      localStorage.setItem(DEVICE_PREFS_KEY, JSON.stringify({ ...existing, ...patch }));
    } catch {}
  };

  const selectMic = async (deviceId: string) => {
    if (!call) return;
    try {
      await call.microphone.disable();
      await call.microphone.select(deviceId);
      await call.microphone.enable();
      updatePrefs({ mic: { selectedDeviceId: deviceId, muted: false } });
    } catch (e) {
      console.warn('Failed to select mic', e);
    }
  };

  const selectCamera = async (deviceId: string) => {
    if (!call) return;
    try {
      await call.camera.disable();
      await call.camera.select(deviceId);
      await call.camera.enable();
      updatePrefs({ camera: { selectedDeviceId: deviceId, muted: false } });
    } catch (e) {
      console.warn('Failed to select camera', e);
    }
  };

  const selectSpeaker = (deviceId: string) => {
    if (!call) return;
    try {
      call.speaker.select(deviceId);
      updatePrefs({ speaker: { selectedDeviceId: deviceId } });
    } catch (e) {
      console.warn('Failed to select speaker', e);
    }
  };

  const tabs = [
    { id: 'camera', label: 'Camera' },
    { id: 'microphone', label: 'Microphone' },
    { id: 'speaker', label: 'Speaker' },
  ] as const;

  const deviceList =
    activeTab === 'camera'
      ? { devices: cameras, selected: selectedCamera, onSelect: selectCamera }
      : activeTab === 'microphone'
      ? { devices: mics, selected: selectedMic, onSelect: selectMic }
      : { devices: speakers, selected: selectedSpeaker, onSelect: selectSpeaker };

  return (
    <div className="flex flex-col h-full w-full bg-transparent relative z-10">
      {/* Tabs */}
      <div className="flex gap-8 border-b border-slate-200 px-8 mt-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-4 text-[14px] font-semibold transition-all relative font-heading ${
              activeTab === tab.id ? 'text-[#110b21] font-bold' : 'text-slate-400 hover:text-slate-600 font-normal'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#110b21] rounded-none" />
            )}
          </button>
        ))}
      </div>

      {/* Device list */}
      <div className={cn(
        "flex flex-col px-8 py-8 flex-1 overflow-y-auto no-scrollbar",
        (!deviceList.devices || deviceList.devices.length === 0) && "justify-center"
      )}>
        {!deviceList.devices || deviceList.devices.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center p-6 bg-transparent relative z-10">
            {activeTab === 'camera' ? (
              <VideoCameraSlash size={36} className="text-slate-400 mb-3" weight="regular" />
            ) : activeTab === 'microphone' ? (
              <MicrophoneSlash size={36} className="text-slate-400 mb-3" weight="regular" />
            ) : (
              <SpeakerSlash size={36} className="text-slate-400 mb-3" weight="regular" />
            )}
            <h3 className="text-sm font-semibold text-slate-800 tracking-tight">
              No {activeTab} detected
            </h3>
            <p className="text-[12px] text-slate-550 mt-1 max-w-[240px] leading-normal">
              Please connect a {activeTab} or check your browser&apos;s permissions.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {deviceList.devices.map((device, index) => {
              const isSelected = deviceList.selected === device.deviceId;
              return (
                <label
                  key={device.deviceId}
                  className={cn(
                    "flex items-center gap-4 justify-between p-4 rounded-none cursor-pointer transition-all duration-200 border",
                    isSelected 
                      ? "bg-white border-black text-[#110b21] shadow-sm" 
                      : "bg-white/60 border-slate-300 text-slate-700 hover:bg-white/80"
                  )}
                  style={{ borderWidth: '0.8px' }}
                >
                  <div className="flex flex-col gap-1 pr-4">
                    <span className={cn(
                      "text-sm transition-colors",
                      isSelected ? "text-black font-bold" : "text-slate-700 font-normal"
                    )}>
                      {device.label || `Default ${activeTab}`}
                    </span>
                    <span className="text-[12px] text-slate-500 leading-tight line-clamp-1">
                      {isSelected ? 'Active Device' : 'Ready to use'}
                    </span>
                  </div>
                  
                  <div className={cn(
                    "size-5 rounded-none flex-center border transition-all",
                    isSelected ? "bg-black border-black text-white" : "border-slate-300 bg-white"
                  )}>
                    {isSelected && <Check weight="bold" size={12} className="text-white" />}
                  </div>
                  <input
                    type="radio"
                    name={activeTab}
                    checked={isSelected}
                    onChange={() => deviceList.onSelect(device.deviceId)}
                    className="hidden"
                  />
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const MeetingSetup = ({
  setIsSetupComplete,
}: {
  setIsSetupComplete: (value: boolean) => void;
}) => {
  const router = useRouter();
  const { useCallEndedAt, useCallStartsAt, useParticipants } = useCallStateHooks();
  const callStartsAt = useCallStartsAt();
  const callEndedAt = useCallEndedAt();
  const participants = useParticipants();

  const callTimeNotArrived =
    callStartsAt && new Date(callStartsAt) > new Date();
  const callHasEnded = !!callEndedAt;

  const call = useCall();
  const { user } = useUser();
  const { toast } = useToast();

  if (!call) {
    throw new Error(
      'useStreamCall must be used within a StreamCall component.',
    );
  }

  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [displayName, setDisplayName] = useState(user?.fullName || user?.username || 'Guest');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Host Identification & Meeting Security
  const hostUserId = call.state.createdBy?.id || (call.state.custom as any)?.createdBy;
  const isHost = Boolean(user?.id && hostUserId === user.id);
  const meetingType = (call.state.custom as any)?.meetingType || 'general';
  const isSecureMeeting = meetingType === 'secure' || meetingType === 'private';

  const [isWaitingForAdmission, setIsWaitingForAdmission] = useState(false);

  const persistentGuestIdRef = useRef<string>('');
  if (!persistentGuestIdRef.current) {
    persistentGuestIdRef.current = user?.id || (typeof window !== 'undefined' ? localStorage.getItem('guestUserId') || '' : '') || `guest_${Math.random().toString(36).substring(2, 9)}`;
    if (typeof window !== 'undefined' && !localStorage.getItem('guestUserId')) {
      localStorage.setItem('guestUserId', persistentGuestIdRef.current);
    }
  }
  const effectiveUserId = user?.id || persistentGuestIdRef.current;

  // Listen for host admission/denial custom events
  useEffect(() => {
    if (!call || isHost) return;

    const handleCustomEvent = (event: any) => {
      const targetId = event.custom?.targetUserId;
      if (event.custom?.type === 'admit-user' && (targetId === effectiveUserId || targetId === user?.id)) {
        setIsWaitingForAdmission(false);
        call.join().then(() => setIsSetupComplete(true)).catch((err) => {
          console.error('[MeetingSetup] Error joining admitted call:', err);
        });
      }
      if (event.custom?.type === 'deny-user' && (targetId === effectiveUserId || targetId === user?.id)) {
        setIsWaitingForAdmission(false);
        toast({
          title: "Admission declined by the host",
          description: "The host has declined your request to join this meeting.",
          variant: "destructive"
        });
        router.push('/');
      }
    };

    const unsubscribe = call.on('custom', handleCustomEvent);
    return () => unsubscribe();
  }, [call, user?.id, effectiveUserId, isHost, setIsSetupComplete, toast, router]);

  // Continuously request admission while in waiting room
  useEffect(() => {
    if (!isWaitingForAdmission || !call || isHost) return;

    const sendRequest = () => {
      call.sendCustomEvent({
        type: 'request-admission',
        userId: effectiveUserId,
        userName: displayName,
        userImage: user?.imageUrl || '',
      }).catch(console.error);
    };

    sendRequest();
    const interval = setInterval(sendRequest, 3000);
    return () => clearInterval(interval);
  }, [isWaitingForAdmission, call, effectiveUserId, displayName, isHost]);

  useEffect(() => {
    const toggleMic = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasMic = devices.some(device => device.kind === 'audioinput');
        
        if (isMicOn && hasMic) {
          await call.microphone.enable();
        } else {
          await call.microphone.disable();
        }
      } catch (err) {
        if (err instanceof Error && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
          console.warn('Microphone permission denied by user');
          return;
        }
        console.error('Error toggling microphone:', err);
      }
    };
    toggleMic();
  }, [isMicOn, call]);

  useEffect(() => {
    const toggleCamera = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasCamera = devices.some(device => device.kind === 'videoinput');

        if (isCameraOn && hasCamera) {
          await call.camera.enable();
        } else {
          await call.camera.disable();
        }
      } catch (err) {
        if (err instanceof Error) {
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            console.warn('Camera permission denied by user');
            return;
          }
          if (err.name === 'NotFoundError' || err.name === 'NotReadableError') {
            return;
          }
        }
        console.error('Error toggling camera:', err);
      }
    };
    toggleCamera();
  }, [isCameraOn, call]);

  if (callTimeNotArrived)
    return (
      <Alert
        title={`Your Meeting has not started yet. It is scheduled for ${callStartsAt.toLocaleString()}`}
      />
    );

  if (callHasEnded)
    return (
      <Alert
        title="The call has been ended by the host"
        iconUrl="/icons/call-ended.svg"
      />
    );

  const participantCount = call.state.participants.length;


  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#f8fafc] p-6 font-heading overflow-hidden relative">
      <NoiseTexture className="opacity-[0.12]" />
      <div
        className="absolute inset-0 z-0 pointer-events-none opacity-50"
        style={{
          backgroundImage: `linear-gradient(to right, #c4cccc 1px, transparent 1px), linear-gradient(to bottom, #c4cccc 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />
      {/* Top Left Branding Logo Text */}
      <div 
        onClick={() => router.push('/')}
        className="absolute top-8 left-8 z-20 cursor-pointer select-none hover:opacity-80 transition-opacity"
      >
        <img src="/logo/logoMain.svg" alt="CastTalk" className="h-8 w-auto object-contain" />
      </div>

      <div className="flex flex-col items-center gap-8 w-full max-w-4xl relative z-10">
        
        {/* Header Section */}
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 mb-0">Ready to join?</h1>
          <p className="text-slate-500 text-base max-w-md font-normal leading-relaxed">Configure your workspace and check your appearance before entering the call.</p>
        </div>

        {/* Video Preview Card */}
        <div className="w-full max-w-2xl aspect-video rounded-sm overflow-hidden relative shadow-[inset_0_1px_0_#ffffff,_0_1px_3px_rgba(0,0,0,0.02),_0_24px_50px_-12px_rgba(0,0,0,0.06)] border border-black/5 bg-slate-900 group" style={{ borderWidth: '0.5px' }}>
          {isCameraOn ? (
            <div className="w-full h-full bg-black [&>*]:!w-full [&>*]:!h-full [&_video]:!w-full [&_video]:!h-full [&_video]:!object-cover [&>div]:!w-full [&>div]:!h-full [&_*]:!border-0 [&_*]:!outline-0 [&_*]:!bg-transparent">
              <VideoPreview />
            </div>
          ) : (
            <div className="w-full h-full bg-[#ecedef] flex items-center justify-center relative overflow-hidden">
              <Ripple 
                mainCircleSize={180} 
                numCircles={5} 
                className="opacity-20"
              />
              
              {user?.imageUrl ? (
                <div className="relative group/avatar">
                  <img 
                    src={user.imageUrl} 
                    alt={displayName}
                    className="w-32 h-32 rounded-full object-cover relative z-10 border-4 border-white shadow-xl"
                  />
                  <div className="absolute inset-0 bg-primary/10 blur-2xl rounded-full scale-75 animate-pulse" />
                </div>
              ) : (
                <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center text-primary text-5xl font-bold relative z-10 border-4 border-white shadow-xl">
                  {user?.firstName?.[0] || user?.username?.[0] || 'U'}
                </div>
              )}
            </div>
          )}
          
          {/* Overlay Badges */}
          <div className="absolute top-6 left-6 z-20 flex items-center gap-2">
             {isWaitingForAdmission && (
               <div className="flex items-center gap-2 bg-amber-500 text-white backdrop-blur-md rounded-none px-3 py-1.5 border border-amber-600 shadow-md">
                  <SpinnerGap className="animate-spin" size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Waiting for host</span>
               </div>
             )}
             {participantCount > 0 && (
               <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md rounded-none px-3 py-1.5 border border-white/10" style={{ borderWidth: '0.8px' }}>
                  <Users weight="bold" size={14} className="text-white" />
                  <span className="text-white text-[10px] font-bold uppercase tracking-widest">{participantCount}</span>
               </div>
             )}
          </div>

          {/* Editable Name Overlay */}
          <div className="absolute bottom-3 left-3 sm:bottom-6 sm:left-6 max-w-[55%] sm:max-w-none flex items-center gap-2 sm:gap-3 bg-black/50 backdrop-blur-md rounded-none p-1.5 sm:p-2 pl-3 sm:pl-4 z-20 border border-white/10 transition-all duration-300 hover:bg-black/70" style={{ borderWidth: '0.8px' }}>
            {isEditingName ? (
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                onBlur={() => setIsEditingName(false)}
                onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
                autoFocus
                className="bg-transparent text-white text-xs sm:text-sm font-semibold outline-none border-none w-24 sm:w-32 placeholder:text-white/40"
              />
            ) : (
              <span className="text-white text-xs sm:text-sm font-semibold truncate">{displayName}</span>
            )}
            <button
              onClick={() => setIsEditingName(!isEditingName)}
              className="size-7 sm:size-8 rounded-none bg-white/10 flex-center text-white hover:bg-white/20 transition-colors shrink-0"
            >
              <PencilSimple size={14} weight="bold" />
            </button>
          </div>

          {/* Setup Status Indicators */}
          <div className="absolute bottom-3 right-3 sm:bottom-6 sm:right-6 z-20 flex gap-1.5 sm:gap-2">
            <div 
              className={cn(
                "size-8 sm:size-10 rounded-none flex-center backdrop-blur-md border transition-all",
                isMicOn 
                  ? (isCameraOn ? "bg-white/20 text-white border-white/10" : "bg-slate-900/10 text-slate-800 border-slate-900/10")
                  : "bg-red-500/80 text-white border-transparent"
              )}
              style={{ borderWidth: '0.8px' }}
            >
              {isMicOn ? <Microphone size={16} weight="bold" /> : <MicrophoneSlash size={16} weight="bold" />}
            </div>
            <div 
              className={cn(
                "size-8 sm:size-10 rounded-none flex-center backdrop-blur-md border transition-all",
                isCameraOn 
                  ? "bg-white/20 text-white border-white/10" 
                  : "bg-red-500/80 text-white border-transparent"
              )}
              style={{ borderWidth: '0.8px' }}
            >
              {isCameraOn ? <VideoCamera size={16} weight="bold" /> : <VideoCameraSlash size={16} weight="bold" />}
            </div>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between w-full max-w-2xl gap-6 pt-4">
          {/* Quick Toggle Controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMicOn(!isMicOn)}
              className={cn(
                "size-14 rounded-none flex-center transition-all duration-300 border shadow-sm group",
                isMicOn 
                  ? "bg-white text-slate-700 border-slate-300 hover:bg-slate-50" 
                  : "bg-red-600 text-white border-red-700 hover:bg-red-700"
              )}
              style={{ borderWidth: '0.8px' }}
            >
              {isMicOn ? <Microphone size={24} weight="regular" /> : <MicrophoneSlash size={24} weight="bold" />}
            </button>
            
            <button
              onClick={() => setIsCameraOn(!isCameraOn)}
              className={cn(
                "size-14 rounded-none flex-center transition-all duration-300 border shadow-sm group",
                isCameraOn 
                  ? "bg-white text-slate-700 border-slate-300 hover:bg-slate-50" 
                  : "bg-red-600 text-white border-red-700 hover:bg-red-700"
              )}
              style={{ borderWidth: '0.8px' }}
            >
              {isCameraOn ? <VideoCamera size={24} weight="regular" /> : <VideoCameraSlash size={24} weight="bold" />}
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="size-14 rounded-none bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-sm flex-center transition-all duration-300 group"
              style={{ borderWidth: '0.8px' }}
            >
              <Gear size={24} weight="regular" className="group-hover:rotate-90 transition-transform duration-500" />
            </button>
          </div>

          <Button
              onClick={async () => {
                if (typeof window !== 'undefined') {
                  localStorage.setItem('streamDisplayName', displayName);
                }
                
                const isHostCurrentlyInCall = call.state.participants.some(p => p.userId === hostUserId);

                if (isHost || (!isSecureMeeting && isHostCurrentlyInCall)) {
                  try {
                    await call.join();
                    setIsSetupComplete(true);
                  } catch (err) {
                    console.error('[MeetingSetup] Failed to join call:', err);
                    toast({
                      title: "Failed to join call",
                      description: err instanceof Error ? err.message : "Unknown error occurred",
                      variant: "destructive"
                    });
                  }
                } else {
                  setIsWaitingForAdmission(true);
                }
              }}
              className="w-full sm:w-auto h-14 px-10 bg-slate-900 hover:bg-slate-800 text-white rounded-none font-bold text-lg shadow-md transition-all active:scale-[0.98]"
            >
              Enter Meeting
            </Button>

        </div>
      </div>

      {/* Settings Sheet */}
      <Sheet open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[440px] bg-[#ecedef] p-0 border-l border-slate-200 flex flex-col font-heading overflow-hidden" style={{ borderWidth: '0.5px' }}>
          <NoiseTexture className="opacity-[0.12]" />
          
          <SheetHeader className="px-8 pt-10 pb-6 bg-transparent border-none relative z-10">
            <div className="flex items-center gap-4">
              <Gear weight="bold" size={32} className="text-slate-900" />
              <div className="flex flex-col text-left justify-center">
                <SheetTitle className="text-2xl text-slate-900 font-bold tracking-tight leading-none mb-[5px]">Workspace</SheetTitle>
                <p className="text-sm text-slate-550 mt-1 leading-tight">Configure your audio and video inputs</p>
              </div>
            </div>
          </SheetHeader>
          <DeviceSettingsPanel />
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default MeetingSetup;
