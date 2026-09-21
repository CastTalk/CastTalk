'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TranscriptLine } from '@/hooks/useTranscription';

/**
 * Google Meet–style floating caption overlay.
 *
 * Renders at the bottom of the video area with a semi-transparent dark
 * background. Shows the last 2 transcript lines + an interim line that
 * updates in real time. Auto-hides after a few seconds of silence.
 */

interface LiveCaptionsProps {
  /** Array of final transcript lines */
  transcript: TranscriptLine[];
  /** Current interim (partial) text being spoken */
  interimText: string;
  /** Whether the transcription engine is actively listening */
  isListening: boolean;
  /** The current user's display name (for speaker label) */
  speakerName?: string;
  /** Any error from the transcription engine */
  error?: string | null;
}

const VISIBLE_LINES = 2;
const AUTO_HIDE_MS = 6000; // Hide after 6s of silence

const LiveCaptions: React.FC<LiveCaptionsProps> = ({
  transcript,
  interimText,
  isListening,
  speakerName = 'You',
  error,
}) => {
  const [visible, setVisible] = useState(false);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Show captions when there's something to display
  const hasContent = interimText.length > 0 || transcript.length > 0;

  useEffect(() => {
    if (hasContent) {
      setVisible(true);
      // Reset the auto-hide timer
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => {
        setVisible(false);
      }, AUTO_HIDE_MS);
    }

    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [hasContent, transcript.length, interimText]);

  // Keep visible while listening, even if no text yet
  useEffect(() => {
    if (isListening && !hasContent) {
      setVisible(true);
    }
  }, [isListening, hasContent]);

  // Get the last N lines to display
  const visibleLines = transcript.slice(-VISIBLE_LINES);

  const shouldShow = (visible && isListening) || !!error;

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          key="live-captions-overlay"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="absolute bottom-20 sm:bottom-24 left-1/2 -translate-x-1/2 z-40 pointer-events-none max-w-[90vw] md:max-w-[680px] w-full"
        >
          <div className="bg-[#202124]/90 backdrop-blur-md rounded-xl px-5 py-3 shadow-2xl border border-white/5">
            {/* Error state */}
            {error && (
              <div className="text-red-400 text-xs font-medium mb-1 flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                {error}
              </div>
            )}


            {/* Final transcript lines */}
            {visibleLines.map((line, i) => (
              <div key={`${line.timestamp}-${i}`} className="mb-0.5 last:mb-0">
                <span className="text-[#8ab4f8] text-xs font-semibold mr-1.5">
                  {line.speaker}
                </span>
                <span className="text-white text-sm leading-relaxed">
                  {line.text}
                </span>
              </div>
            ))}

            {/* Interim (partial) text — shown in lighter color */}
            {interimText && (
              <div className="mt-0.5">
                <span className="text-[#8ab4f8] text-xs font-semibold mr-1.5">
                  {speakerName}
                </span>
                <span className="text-slate-300 text-sm leading-relaxed italic">
                  {interimText}
                </span>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LiveCaptions;
