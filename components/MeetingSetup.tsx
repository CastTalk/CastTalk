'use client';
import { useEffect, useState } from 'react';
import {
  VideoPreview,
  useCall,
  useCallStateHooks,
} from '@stream-io/video-react-sdk';
import { Mic, MicOff, Video, VideoOff, Settings, Pencil } from 'lucide-react';
import { useUser } from '@clerk/nextjs';
import { Ripple } from './ui/ripple';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';
import Alert from './Alert';
import { Button } from './ui/button';

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
    <div className="flex flex-col h-full w-full">
      {/* Tabs */}
      <div className="flex gap-6 border-b border-gray-200 px-6 mt-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 text-[14px] font-medium transition-colors relative font-heading ${
              activeTab === tab.id ? 'text-blue-600' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-600" />
            )}
          </button>
        ))}
      </div>

      {/* Device list */}
      <div className="flex flex-col px-6 py-6 pb-10 flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <h2 className="text-[17px] font-semibold text-gray-900 mb-2">
          {tabs.find(t => t.id === activeTab)?.label}
        </h2>
        
        <div className="flex flex-col mt-4">
          {deviceList.devices?.map((device, index) => {
            const isSelected = deviceList.selected === device.deviceId;
            return (
              <label
                key={device.deviceId}
                className={`flex items-start gap-4 justify-between py-5 cursor-pointer group ${
                  index !== deviceList.devices!.length - 1 ? 'border-b border-gray-100' : ''
                }`}
              >
                <div className="flex flex-col gap-1.5 pr-4">
                  <span className={`text-[15px] font-medium leading-tight transition-colors ${isSelected ? 'text-blue-600' : 'text-gray-900 group-hover:text-blue-400'}`}>
                    {device.label || `Default ${activeTab}`}
                  </span>
                  <span className="text-xs text-gray-400 leading-snug">
                    {(() => {
                      const label = (device.label || '').toLowerCase();
                      if (activeTab === 'camera') {
                        if (label.includes('virtual') || label.includes('obs')) return 'Virtual or software-based camera source.';
                        if (label.includes('integrated') || label.includes('built-in')) return 'Built-in camera on your device.';
                        if (label.includes('bluetooth')) return 'Wireless Bluetooth camera.';
                        return 'External camera connected to your device.';
                      }
                      if (activeTab === 'microphone') {
                        if (label.includes('cable') || label.includes('virtual')) return 'Virtual audio cable — typically used for routing audio.';
                        if (label.includes('bluetooth') || label.includes('headset')) return 'Wireless headset microphone.';
                        if (label.includes('array')) return 'Built-in microphone array on your device.';
                        if (label.includes('default')) return 'System default microphone input.';
                        if (label.includes('communications')) return 'Optimized for voice calls and communication.';
                        return 'External microphone input.';
                      }
                      if (activeTab === 'speaker') {
                        if (label.includes('bluetooth') || label.includes('headphone') || label.includes('headset')) return 'Wireless audio output via Bluetooth.';
                        if (label.includes('default')) return 'System default audio output.';
                        if (label.includes('communications')) return 'Optimized output for calls and communication.';
                        if (label.includes('cable') || label.includes('virtual')) return 'Virtual audio cable output.';
                        if (label.includes('epson') || label.includes('projector')) return 'Audio output through connected projector.';
                        return 'External speaker or audio output device.';
                      }
                      return 'Select this as your preferred device.';
                    })()}
                  </span>
                </div>
                
                <div className="relative flex items-center shrink-0 pt-0.5">
                  <input
                    type="radio"
                    name={activeTab}
                    checked={isSelected}
                    onChange={() => deviceList.onSelect(device.deviceId)}
                    className="w-4 h-4 accent-blue-600 border-gray-300 focus:ring-blue-600 cursor-pointer"
                  />
                </div>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const MeetingSetup = ({
  setIsSetupComplete,
}: {
  setIsSetupComplete: (value: boolean) => void;
}) => {
  const { useCallEndedAt, useCallStartsAt } = useCallStateHooks();
  const callStartsAt = useCallStartsAt();
  const callEndedAt = useCallEndedAt();
  const callTimeNotArrived =
    callStartsAt && new Date(callStartsAt) > new Date();
  const callHasEnded = !!callEndedAt;

  const call = useCall();
  const { user } = useUser();

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

  useEffect(() => {
    if (isMicOn) {
      call.microphone.enable();
    } else {
      call.microphone.disable();
    }
  }, [isMicOn, call.microphone]);

  useEffect(() => {
    if (isCameraOn) {
      call.camera.enable();
    } else {
      call.camera.disable();
    }
  }, [isCameraOn, call.camera]);

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
    <div className="flex h-screen w-full flex-col items-center justify-center bg-white p-6 font-heading overflow-hidden relative">
      {/* Subtle grid background with gradient fade */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(0,0,0,0.08) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0,0,0,0.08) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.6) 40%, rgba(0,0,0,0.2) 70%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.6) 40%, rgba(0,0,0,0.2) 70%, transparent 100%)'
        }}
      />
      
      <div className="flex flex-col items-center gap-4 w-full max-w-4xl relative z-10 mb-16">
        
        {/* Header */}
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-3xl font-semibold text-gray-900">Get Started</h1>
          <p className="text-gray-500 text-sm">Prepare your audio and video setup before connecting</p>
        </div>

        {/* Participant Count Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-red-500 rounded-full px-3 py-1.5">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-white text-xs font-semibold">LIVE</span>
          </div>
          <div className="bg-gray-200 rounded-full px-3 py-1.5">
            <span className="text-gray-700 text-xs">{participantCount} participant{participantCount !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Video Preview */}
        <div className="w-full max-w-2xl aspect-video rounded-2xl overflow-hidden relative">
          {isCameraOn ? (
            <div className="w-full h-full bg-black [&>*]:!w-full [&>*]:!h-full [&_video]:!w-full [&_video]:!h-full [&_video]:!object-cover [&>div]:!w-full [&>div]:!h-full [&_*]:!border-0 [&_*]:!outline-0 [&_*]:!bg-transparent">
              <VideoPreview />
            </div>
          ) : (
            <div className="w-full h-full bg-gray-150 flex items-center justify-center relative overflow-hidden" style={{ backgroundColor: '#e8e8e8' }}>
              {/* Ripple effect with gradient */}
              <Ripple 
                mainCircleSize={150} 
                mainCircleOpacity={0.6} 
                numCircles={6} 
                className="[&_.animate-ripple:nth-child(1)]:!border-[#8b7d6b]/70 [&_.animate-ripple:nth-child(1)]:!bg-[#8b7d6b]/30 [&_.animate-ripple:nth-child(2)]:!border-[#9d8f7d]/60 [&_.animate-ripple:nth-child(2)]:!bg-[#9d8f7d]/25 [&_.animate-ripple:nth-child(3)]:!border-[#afa18f]/50 [&_.animate-ripple:nth-child(3)]:!bg-[#afa18f]/20 [&_.animate-ripple:nth-child(4)]:!border-[#c1b3a1]/40 [&_.animate-ripple:nth-child(4)]:!bg-[#c1b3a1]/15 [&_.animate-ripple:nth-child(5)]:!border-[#d3c5b3]/30 [&_.animate-ripple:nth-child(5)]:!bg-[#d3c5b3]/10 [&_.animate-ripple:nth-child(6)]:!border-[#e5d7c5]/20 [&_.animate-ripple:nth-child(6)]:!bg-[#e5d7c5]/5" 
              />
              
              {user?.imageUrl ? (
                <img 
                  src={user.imageUrl} 
                  alt={displayName}
                  className="w-32 h-32 rounded-full object-cover relative z-10"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-gray-400 flex items-center justify-center text-white text-5xl font-bold relative z-10">
                  {user?.firstName?.[0] || user?.username?.[0] || 'U'}
                </div>
              )}
            </div>
          )}
          
          {/* Editable Name Overlay */}
          <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 z-10">
            {isEditingName ? (
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                onBlur={() => setIsEditingName(false)}
                onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
                autoFocus
                className="bg-transparent text-white text-sm font-medium outline-none !border-b !border-white/50 w-32"
              />
            ) : (
              <span className="text-white text-sm font-medium">{displayName}</span>
            )}
            <button
              onClick={() => setIsEditingName(!isEditingName)}
              className="text-white/80 hover:text-white transition-colors"
            >
              <Pencil size={14} />
            </button>
          </div>

          {/* Join Button Overlay - bottom right */}
          <div className="absolute bottom-4 right-4 z-10">
            <Button
              onClick={() => {
                call.join();
                setIsSetupComplete(true);
              }}
              className="bg-blue-1 hover:bg-blue-1/90 text-white px-6 py-2 rounded-lg font-semibold text-sm h-auto"
            >
              JOIN NOW
            </Button>
          </div>
        </div>

        {/* Controls Row - Mic, Camera, Join, Settings */}
        <div className="flex items-center justify-between w-full max-w-2xl gap-4">
          {/* Left side - Mic and Camera */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMicOn(!isMicOn)}
              className="w-12 h-12 rounded-full flex items-center justify-center transition-all backdrop-blur-md border border-white/30 shadow-sm"
              style={{ backgroundColor: isMicOn ? 'rgba(228, 230, 235, 0.7)' : 'rgba(239, 68, 68, 0.85)' }}
            >
              {isMicOn ? <Mic size={18} strokeWidth={1.5} className="text-gray-800" /> : <MicOff size={18} strokeWidth={1.5} className="text-white" />}
            </button>
            
            <button
              onClick={() => setIsCameraOn(!isCameraOn)}
              className="w-12 h-12 rounded-full flex items-center justify-center transition-all backdrop-blur-md border border-white/30 shadow-sm"
              style={{ backgroundColor: isCameraOn ? 'rgba(228, 230, 235, 0.7)' : 'rgba(239, 68, 68, 0.85)' }}
            >
              {isCameraOn ? <Video size={18} strokeWidth={1.5} className="text-gray-800" /> : <VideoOff size={18} strokeWidth={1.5} className="text-white" />}
            </button>
          </div>

          {/* Right side - Settings */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="w-12 h-12 rounded-full flex items-center justify-center transition-all backdrop-blur-md border border-white/30 shadow-sm"
            style={{ backgroundColor: 'rgba(228, 230, 235, 0.7)' }}
          >
            <Settings size={18} strokeWidth={1.5} className="text-gray-800" />
          </button>

          <Sheet open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <SheetContent side="right" className="w-[370px] sm:max-w-[370px] bg-white shadow-2xl p-0 border-none sm:border-l sm:border-gray-200 flex flex-col gap-0 font-heading">
              <SheetHeader className="px-6 pt-8 pb-4 bg-white border-none">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl border border-gray-200 flex items-center justify-center bg-white shadow-sm shrink-0">
                    <Settings className="w-7 h-7 text-gray-800" />
                  </div>
                  <div className="flex flex-col text-left">
                    <SheetTitle className="text-xl text-gray-900 font-semibold leading-tight">Device Settings</SheetTitle>
                    <p className="text-[14px] text-gray-500 mt-1">Audio and video workspace</p>
                  </div>
                </div>
              </SheetHeader>
              <DeviceSettingsPanel />
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </div>
  );
};

export default MeetingSetup;
