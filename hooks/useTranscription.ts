'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Speechmatics real-time transcription hook for Taglish (Tagalog + English).
 *
 * Uses the raw WebSocket protocol (no SDK dependency):
 *   1. Fetches a temporary JWT from our server route
 *   2. Opens a WebSocket to wss://eu2.rt.speechmatics.com/v2
 *   3. Sends StartRecognition with language "tl" (Tagalog & English bilingual pack)
 *   4. Captures mic audio via AudioWorklet, converts to PCM16 @ 16kHz, sends as binary
 *   5. Receives AddPartialTranscript (interim) and AddTranscript (final) messages
 */

export interface TranscriptLine {
  speaker: string;
  text: string;
  timestamp: number;
}

export interface UseTranscriptionOptions {
  /** Optional callback fired whenever a transcript segment arrives */
  onTranscript?: (segment: { text: string; speaker: string; isPartial?: boolean }) => void;
}

interface UseTranscriptionReturn {
  /** The final, committed transcript text */
  transcript: TranscriptLine[];
  /** In-progress interim text */
  interimText: string;
  /** Whether the transcription engine is actively listening */
  isListening: boolean;
  /** Any error that occurred */
  error: string | null;
  /** Start transcription — requests mic permission + connects WebSocket */
  start: (speakerName?: string) => Promise<void>;
  /** Stop transcription — disconnects WebSocket + releases mic */
  stop: () => void;
}

// AudioWorklet processor code inlined as a Blob URL (avoids a separate file)
const WORKLET_CODE = `
class PcmCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input[0] && input[0].length > 0) {
      // input[0] is Float32Array of samples for channel 0
      this.port.postMessage(input[0].slice());
    }
    return true;
  }
}
registerProcessor('pcm-capture-processor', PcmCaptureProcessor);
`;

/**
 * Convert Float32 audio samples to Int16 PCM (Little-Endian).
 * Speechmatics expects `pcm_s16le` encoding.
 */
function float32ToPcm16(float32: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32.length; i++) {
    // Clamp to [-1, 1] then scale to Int16 range
    const s = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

/**
 * Downsample from the browser's native sample rate to 16kHz.
 * Uses simple linear interpolation.
 */
function downsampleBuffer(
  buffer: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number
): Float32Array {
  if (inputSampleRate === outputSampleRate) return buffer;
  const ratio = inputSampleRate / outputSampleRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const index = i * ratio;
    const low = Math.floor(index);
    const high = Math.min(low + 1, buffer.length - 1);
    const frac = index - low;
    result[i] = buffer[low] * (1 - frac) + buffer[high] * frac;
  }
  return result;
}

const TARGET_SAMPLE_RATE = 16000;

// Speechmatics WebSocket URL — eu2 region
const SM_WS_BASE = 'wss://eu2.rt.speechmatics.com/v2';

export function useTranscription(options?: UseTranscriptionOptions): UseTranscriptionReturn {
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [interimText, setInterimText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const speakerNameRef = useRef('You');
  const isStoppingRef = useRef(false);

  // Accumulate final transcript text for the current "utterance"
  const finalAccRef = useRef('');

  const cleanup = useCallback(() => {
    // Close WebSocket
    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ message: 'EndOfStream', last_seq_no: 0 }));
        }
        wsRef.current.close();
      } catch { /* ignore */ }
      wsRef.current = null;
    }

    // Disconnect AudioWorklet
    if (workletNodeRef.current) {
      try { workletNodeRef.current.disconnect(); } catch { /* ignore */ }
      workletNodeRef.current = null;
    }

    // Close AudioContext
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch { /* ignore */ }
      audioCtxRef.current = null;
    }

    // Stop mic tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    setIsListening(false);
  }, []);

  // Auto-cleanup on unmount
  useEffect(() => {
    return () => {
      isStoppingRef.current = true;
      cleanup();
    };
  }, [cleanup]);

  const start = useCallback(async (speakerName?: string) => {
    if (isListening) return;
    speakerNameRef.current = speakerName || 'You';
    setError(null);
    setTranscript([]);
    setInterimText('');
    finalAccRef.current = '';
    isStoppingRef.current = false;

    try {
      // 1. Get temporary JWT from our server
      const tokenRes = await fetch('/api/speechmatics/token', { method: 'POST' });
      if (!tokenRes.ok) {
        const body = await tokenRes.json().catch(() => ({}));
        throw new Error(body.error || `Token request failed (${tokenRes.status})`);
      }
      const { jwt } = await tokenRes.json();
      if (!jwt) throw new Error('No JWT returned from token endpoint');

      // 2. Request mic access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      streamRef.current = stream;

      // 3. Set up AudioContext + AudioWorklet for PCM capture
      const audioCtx = new AudioContext({ sampleRate: 48000 });
      audioCtxRef.current = audioCtx;

      const workletBlobUrl = URL.createObjectURL(
        new Blob([WORKLET_CODE], { type: 'application/javascript' })
      );
      await audioCtx.audioWorklet.addModule(workletBlobUrl);
      URL.revokeObjectURL(workletBlobUrl);

      const source = audioCtx.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioCtx, 'pcm-capture-processor');
      workletNodeRef.current = workletNode;

      source.connect(workletNode);
      // Don't connect to destination — we only want to capture, not play back

      // 4. Open WebSocket to Speechmatics
      const ws = new WebSocket(`${SM_WS_BASE}?jwt=${jwt}`);
      wsRef.current = ws;

      ws.onopen = () => {
        // Send StartRecognition config
        // StartRecognition with ultra-low latency config (0.7s max_delay + flexible mode)
        ws.send(
          JSON.stringify({
            message: 'StartRecognition',
            audio_format: {
              type: 'raw',
              encoding: 'pcm_s16le',
              sample_rate: TARGET_SAMPLE_RATE,
            },
            transcription_config: {
              language: 'tl', // Tagalog & English bilingual pack
              operating_point: 'standard', // Fast, low-latency model
              max_delay: 0.7, // Lowest delay allowed by Speechmatics for real-time responsiveness
              max_delay_mode: 'flexible',
              enable_partials: true, // Stream words real-time with instant latency
            },
          })
        );
      };

      ws.onmessage = (event) => {
        if (isStoppingRef.current) return;

        try {
          const msg = JSON.parse(event.data as string);

          if (msg.message === 'RecognitionStarted') {
            setIsListening(true);

            // Voice Activity Detection (VAD) to preserve Speechmatics API usage:
            // When silence is detected, audio packets are NOT sent to WebSocket.
            // When speech is detected, pre-roll buffer flushes and audio streams immediately.
            const VAD_THRESHOLD = 0.005; // Sensitive threshold to catch soft speech instantly
            const HANGOVER_MS = 1200; // 1.2s hangover keeps audio flowing during natural speech pauses
            const PRE_ROLL_MAX = 3;
            const preRollChunks: Float32Array[] = [];
            let lastSpeechTime = 0;
            let isSilentMode = true;

            workletNode.port.onmessage = (e: MessageEvent<Float32Array>) => {
              if (ws.readyState !== WebSocket.OPEN) return;
              const samples = e.data;
              if (!samples || samples.length === 0) return;

              // RMS amplitude calculation
              let sum = 0;
              for (let i = 0; i < samples.length; i++) {
                sum += samples[i] * samples[i];
              }
              const rms = Math.sqrt(sum / samples.length);

              const now = Date.now();
              if (rms >= VAD_THRESHOLD) {
                lastSpeechTime = now;
              }

              preRollChunks.push(samples);
              if (preRollChunks.length > PRE_ROLL_MAX) {
                preRollChunks.shift();
              }

              const isSpeaking = (now - lastSpeechTime) < HANGOVER_MS;

              if (isSpeaking) {
                if (isSilentMode) {
                  // Waking up from silence: flush pre-roll chunks first
                  isSilentMode = false;
                  while (preRollChunks.length > 0) {
                    const chunk = preRollChunks.shift()!;
                    const downsampled = downsampleBuffer(chunk, audioCtx.sampleRate, TARGET_SAMPLE_RATE);
                    ws.send(float32ToPcm16(downsampled));
                  }
                }
                // Send current chunk immediately
                const downsampled = downsampleBuffer(samples, audioCtx.sampleRate, TARGET_SAMPLE_RATE);
                ws.send(float32ToPcm16(downsampled));
              } else {
                // In silence/standby: zero audio packets sent to API to save credits!
                isSilentMode = true;
              }
            };
          }

          if (msg.message === 'AddPartialTranscript') {
            const partialText = (msg.results || [])
              .map((r: any) => r.alternatives?.[0]?.content || '')
              .join(' ')
              .trim();

            // Ignore punctuation-only tokens like lone '.' or '...'
            if (partialText && /[a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF]/.test(partialText)) {
              setInterimText(partialText);
              optionsRef.current?.onTranscript?.({
                text: partialText,
                speaker: speakerNameRef.current,
                isPartial: true,
              });
            }
          }

          if (msg.message === 'AddTranscript') {
            // Final committed transcript segment
            const finalText = (msg.results || [])
              .map((r: any) => r.alternatives?.[0]?.content || '')
              .join(' ')
              .trim();

            // Ignore punctuation-only tokens like lone '.' or '...'
            if (finalText && /[a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF]/.test(finalText)) {
              setInterimText('');
              // Notify callback
              optionsRef.current?.onTranscript?.({
                text: finalText,
                speaker: speakerNameRef.current,
                isPartial: false,
              });

              // Append space-separated to our accumulated text
              finalAccRef.current = finalAccRef.current
                ? `${finalAccRef.current} ${finalText}`
                : finalText;

              setTranscript((prev) => {
                const lastLine = prev[prev.length - 1];
                const now = Date.now();

                // If the last line is from the same speaker and recent (< 8s), extend it
                if (
                  lastLine &&
                  lastLine.speaker === speakerNameRef.current &&
                  now - lastLine.timestamp < 8000
                ) {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    ...lastLine,
                    text: `${lastLine.text} ${finalText}`,
                    timestamp: now,
                  };
                  return updated;
                }

                // Otherwise, start a new line
                return [
                  ...prev,
                  {
                    speaker: speakerNameRef.current,
                    text: finalText,
                    timestamp: now,
                  },
                ];
              });

              // Clear interim since it's now committed
              setInterimText('');
            }
          }

          if (msg.message === 'EndOfTranscript') {
            // Server confirmed end — graceful shutdown
            cleanup();
          }

          if (msg.message === 'Error') {
            console.error('[Speechmatics] Error message:', msg);
            setError(msg.reason || 'Transcription error');
            cleanup();
          }
        } catch {
          // Ignore non-JSON messages (e.g. binary acks)
        }
      };

      ws.onerror = (e) => {
        console.error('[Speechmatics] WebSocket error:', e);
        if (!isStoppingRef.current) {
          setError('Connection to transcription service failed');
        }
        cleanup();
      };

      ws.onclose = (e) => {
        if (!isStoppingRef.current && e.code !== 1000) {
          console.warn('[Speechmatics] WebSocket closed unexpectedly:', e.code, e.reason);
          setError(`Transcription disconnected (code ${e.code})`);
        }
        setIsListening(false);
      };
    } catch (err: any) {
      console.error('[useTranscription] start failed:', err);
      setError(err.message || 'Failed to start transcription');
      cleanup();
    }
  }, [isListening, cleanup]);

  const stop = useCallback(() => {
    isStoppingRef.current = true;
    cleanup();
    setInterimText('');
  }, [cleanup]);

  return { transcript, interimText, isListening, error, start, stop };
}
