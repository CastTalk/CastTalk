'use client';

import React, { useEffect, useRef } from 'react';
import { 
  X, 
  Sparkle, 
  ClosedCaptioning, 
  MicrophoneSlash, 
  StopCircle
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

export interface TranscriptItem {
  id: string;
  userId: string;
  speaker: string;
  text: string;
  timestamp: number;
  avatar?: string;
  isLocal?: boolean;
}

interface GoogleMeetTranscriptsSidebarProps {
  onClose: () => void;
  isListening: boolean;
  isMicMuted: boolean;
  onStart: () => void;
  onStop: () => void;
  transcripts: TranscriptItem[];
  interimText?: string;
  activeSpeakerName?: string;
  localSpeakerName?: string;
  onOpenCastAI?: () => void;
}

export const GoogleMeetTranscriptsSidebar: React.FC<GoogleMeetTranscriptsSidebarProps> = ({
  onClose,
  isListening,
  isMicMuted,
  onStart,
  onStop,
  transcripts,
  interimText,
  activeSpeakerName,
  localSpeakerName = 'You',
  onOpenCastAI,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new transcripts or interim updates
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts, interimText]);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const hasTranscripts = transcripts.length > 0 || (interimText && interimText.trim().length > 0);
  const currentSpeaker = activeSpeakerName || localSpeakerName;

  return (
    <div className="flex flex-col h-full w-full bg-[#202124] text-white rounded-2xl border border-[#3c4043] shadow-2xl overflow-hidden font-sans select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#3c4043]/60 bg-[#202124] shrink-0">
        <h2 className="text-lg font-medium tracking-tight text-white">Transcripts</h2>
        <button 
          onClick={onClose}
          className="p-1.5 -mr-1 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
          title="Close transcripts"
        >
          <X size={18} weight="bold" />
        </button>
      </div>

      {/* Main Content Area */}
      {!isListening && !hasTranscripts ? (
        /* Empty / Not Started State (Exact Google Meet illustration layout) */
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center overflow-y-auto">
          {/* Google Meet Document / Speech Illustration */}
          <div className="w-48 h-36 mb-6 relative flex items-center justify-center">
            <svg viewBox="0 0 200 150" className="w-full h-full text-slate-400" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Whiteboard / Sheet */}
              <rect x="35" y="25" width="130" height="95" rx="6" fill="#2d2f34" stroke="#5f6368" strokeWidth="2" />
              {/* Top blue bar */}
              <path d="M35 31 C35 27.6863 37.6863 25 41 25 L159 25 C162.314 25 165 27.6863 165 31 L165 38 L35 38 Z" fill="#8ab4f8" />
              {/* Text lines */}
              <rect x="48" y="48" width="80" height="4" rx="2" fill="#5f6368" />
              <rect x="48" y="58" width="104" height="4" rx="2" fill="#3c4043" />
              <rect x="48" y="68" width="92" height="4" rx="2" fill="#3c4043" />
              <rect x="48" y="78" width="60" height="4" rx="2" fill="#3c4043" />
              {/* Speech bubble */}
              <rect x="100" y="88" width="55" height="24" rx="12" fill="#1a73e8" />
              <circle cx="114" cy="100" r="2" fill="#ffffff" />
              <circle cx="127" cy="100" r="2" fill="#ffffff" />
              <circle cx="140" cy="100" r="2" fill="#ffffff" />
              {/* Mini avatar figure */}
              <circle cx="48" cy="102" r="8" fill="#a8c7fa" />
              <path d="M40 120 C40 114 43 111 48 111 C53 111 56 114 56 120" stroke="#a8c7fa" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>

          <h3 className="text-base font-semibold text-white mb-2">Transcribe this call</h3>
          <p className="text-xs text-slate-400 leading-relaxed max-w-[280px] mb-8">
            Real-time speech to text will be generated as participants speak. Bilingual Tagalog and English (Taglish) is supported.
          </p>

          <button
            onClick={onStart}
            className="px-6 py-2.5 bg-[#1a73e8] hover:bg-[#1b66c9] active:bg-[#1557b0] text-white text-sm font-medium rounded-full transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            <ClosedCaptioning size={18} weight="bold" />
            <span>Start transcription</span>
          </button>
        </div>
      ) : (
        /* Active Transcription View */
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Subheader / Status & Action bar */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#1e1f21] border-b border-[#3c4043]/50 text-xs shrink-0">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className={cn(
                  "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                  isListening && !isMicMuted ? "bg-emerald-400" : "bg-amber-400"
                )} />
                <span className={cn(
                  "relative inline-flex rounded-full h-2 w-2",
                  isListening && !isMicMuted ? "bg-emerald-500" : "bg-amber-500"
                )} />
              </span>
              <span className="font-medium text-slate-300">
                {isListening ? (isMicMuted ? 'Transcription on (Muted)' : 'Transcribing live') : 'Transcription paused'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* CastAI Button */}
              <button
                onClick={onOpenCastAI}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-[#1a73e8]/20 text-[#8ab4f8] hover:bg-[#1a73e8]/30 transition-colors border border-[#8ab4f8]/30 cursor-pointer"
                title="Open CastAI Assistant with meeting memory"
              >
                <Sparkle size={14} weight="fill" className="text-[#8ab4f8]" />
                <span>CastAI</span>
              </button>
            </div>
          </div>

          {/* Mic Muted Banner */}
          {isListening && isMicMuted && (
            <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 flex items-center gap-2 text-amber-300 text-xs shrink-0">
              <MicrophoneSlash size={16} weight="bold" className="shrink-0" />
              <span>Your microphone is muted. Unmute to capture your voice.</span>
            </div>
          )}

          {/* Transcript Scroll Area */}
          <div 
            ref={scrollRef} 
            className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar min-h-0"
          >
            {transcripts.map((item, index) => {
              const isLastItem = index === transcripts.length - 1;
              const isCurrentSpeaker = item.speaker === currentSpeaker;
              const hasActiveTrailer = isLastItem && isCurrentSpeaker && isListening && !!interimText;

              return (
                <div key={item.id} className="flex gap-3 text-left">
                  {item.avatar ? (
                    <img 
                      src={item.avatar} 
                      alt={item.speaker} 
                      className="w-8 h-8 rounded-full object-cover shrink-0 mt-0.5" 
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#3c4043] border border-white/10 flex items-center justify-center text-xs font-semibold text-white uppercase shrink-0 mt-0.5">
                      {item.speaker[0] || 'U'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-semibold text-xs text-white truncate max-w-[170px]">
                        {item.speaker}
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {formatTime(item.timestamp)}
                      </span>
                    </div>
                    <p className="text-[13px] text-slate-200 leading-relaxed break-words">
                      {item.text}
                      {hasActiveTrailer && (
                        <span className="text-slate-300">
                          {' '}{interimText}
                          <span className="inline-block w-1.5 h-3.5 ml-1 bg-[#8ab4f8] animate-pulse align-middle rounded-xs" />
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              );
            })}

            {/* If speaking and either no transcripts exist or last transcript wasn't from current speaker */}
            {isListening && interimText && (transcripts.length === 0 || transcripts[transcripts.length - 1]?.speaker !== currentSpeaker) && (
              <div className="flex gap-3 text-left">
                <div className="w-8 h-8 rounded-full bg-[#3c4043] border border-white/10 flex items-center justify-center text-xs font-semibold text-white uppercase shrink-0 mt-0.5">
                  {currentSpeaker[0] || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-semibold text-xs text-white truncate max-w-[170px]">
                      {currentSpeaker}
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[13px] text-slate-300 leading-relaxed break-words">
                    {interimText}
                    <span className="inline-block w-1.5 h-3.5 ml-1 bg-[#8ab4f8] animate-pulse align-middle rounded-xs" />
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GoogleMeetTranscriptsSidebar;
