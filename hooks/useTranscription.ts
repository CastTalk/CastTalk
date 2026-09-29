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
 *
 * Resilience features:
 *   - Auto-reconnect with exponential backoff on unexpected disconnects (up to 5 retries)
 *   - Periodic health-check polling to detect dead WebSocket connections early
 *   - Pause/resume for mic mute without tearing down the connection
 *   - Connection state tracking (connected, reconnecting, failed)
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

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

interface UseTranscriptionReturn {
  /** The final, committed transcript text */
  transcript: TranscriptLine[];
  /** In-progress interim text */
  interimText: string;
  /** Whether the transcription engine is actively listening */
  isListening: boolean;
  /** Whether audio sending is paused (mic muted but connection alive) */
  isPaused: boolean;
  /** Connection status for UI feedback */
  connectionStatus: ConnectionStatus;
  /** Any error that occurred */
  error: string | null;
  /** Start transcription — requests mic permission + connects WebSocket */
  start: (speakerName?: string) => Promise<void>;
  /** Pause audio sending — keeps WebSocket alive (use for mic mute) */
  pause: () => void;
  /** Resume audio sending — resumes from pause (use for mic unmute) */
  resume: () => void;
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

// Reconnection config
const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY_MS = 1000; // 1s, 2s, 4s, 8s, 16s exponential backoff
const HEALTH_CHECK_INTERVAL_MS = 15_000; // Check connection health every 15s
const LAST_MESSAGE_TIMEOUT_MS = 45_000; // Consider connection dead if no message for 45s

export function useTranscription(options?: UseTranscriptionOptions): UseTranscriptionReturn {
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [interimText, setInterimText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
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
  const isPausedRef = useRef(false);

  // Reconnection state
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const healthCheckTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMessageTimeRef = useRef(0);
  const isReconnectingRef = useRef(false);

  // Accumulate final transcript text for the current "utterance"
  const finalAccRef = useRef('');

  /** Clear all timers */
  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (healthCheckTimerRef.current) {
      clearInterval(healthCheckTimerRef.current);
      healthCheckTimerRef.current = null;
    }
  }, []);

  /** Tear down WebSocket + audio pipeline (without triggering reconnect) */
  const cleanupConnection = useCallback(() => {
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
  }, []);

  /** Full cleanup — tears down everything and resets all state */
  const cleanup = useCallback(() => {
    clearTimers();
    cleanupConnection();
    reconnectAttemptRef.current = 0;
    isReconnectingRef.current = false;
    setIsListening(false);
    setIsPaused(false);
    isPausedRef.current = false;
    setConnectionStatus('disconnected');
  }, [clearTimers, cleanupConnection]);

  // Auto-cleanup on unmount & page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      isStoppingRef.current = true;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ message: 'EndOfStream', last_seq_no: 0 }));
          wsRef.current.close(1000, 'Page unloaded');
        } catch {}
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      isStoppingRef.current = true;
      cleanup();
    };
  }, [cleanup]);

  /**
   * Core connection logic — extracted so it can be called by both
   * start() (initial) and the auto-reconnect mechanism.
   */
  const connect = useCallback(async (speakerName: string, isReconnect: boolean = false) => {
    if (!isReconnect) {
      setError(null);
      setInterimText('');
      finalAccRef.current = '';
    }

    setConnectionStatus(isReconnect ? 'reconnecting' : 'connecting');

    try {
      // 1. Get temporary JWT from our server
      const tokenRes = await fetch('/api/speechmatics/token', { method: 'POST' });
      if (!tokenRes.ok) {
        const body = await tokenRes.json().catch(() => ({}));
        throw new Error(body.error || `Token request failed (${tokenRes.status})`);
      }
      const { jwt } = await tokenRes.json();
      if (!jwt) throw new Error('No JWT returned from token endpoint');

      // 2. Request mic access (reuse existing stream during reconnect if possible)
      let stream = streamRef.current;
      if (!stream || stream.getTracks().every(t => t.readyState === 'ended')) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          },
        });
        streamRef.current = stream;
      }

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

        // Track last message time for health-check polling
        lastMessageTimeRef.current = Date.now();

        try {
          const msg = JSON.parse(event.data as string);

          if (msg.message === 'RecognitionStarted') {
            // Successfully connected — reset reconnect state
            reconnectAttemptRef.current = 0;
            isReconnectingRef.current = false;
            setIsListening(true);
            setConnectionStatus('connected');
            setError(null);

            if (isReconnect) {
              console.log('[Speechmatics] Reconnected successfully');
            }

            // Start health-check polling
            if (healthCheckTimerRef.current) clearInterval(healthCheckTimerRef.current);
            healthCheckTimerRef.current = setInterval(() => {
              const now = Date.now();
              const lastMsg = lastMessageTimeRef.current;

              // Check if WebSocket is still actually open
              if (wsRef.current?.readyState !== WebSocket.OPEN) {
                console.warn('[Speechmatics] Health check: WebSocket not open, triggering reconnect');
                attemptReconnect();
                return;
              }

              // Check if we've received any message recently
              // (Speechmatics sends periodic messages even during silence)
              if (lastMsg > 0 && (now - lastMsg) > LAST_MESSAGE_TIMEOUT_MS) {
                console.warn('[Speechmatics] Health check: No message for', Math.round((now - lastMsg) / 1000), 's — triggering reconnect');
                attemptReconnect();
              }
            }, HEALTH_CHECK_INTERVAL_MS);

            // Voice Activity Detection (VAD) to preserve Speechmatics API usage:
            // When silence is detected, audio packets are NOT sent to WebSocket.
            // When speech is detected, pre-roll buffer flushes and audio streams immediately.
            const VAD_THRESHOLD = 0.005; // Sensitive threshold to catch soft speech instantly
            const HANGOVER_MS = 1200; // 1.2s hangover keeps audio flowing during natural speech pauses
            const PRE_ROLL_MAX = 3;
            const preRollChunks: Float32Array[] = [];
            let lastSpeechTime = 0;
            let isSilentMode = true;

            const safeSend = (data: ArrayBufferLike | ArrayBufferView | string | Blob) => {
              if (ws && ws.readyState === WebSocket.OPEN) {
                try {
                  ws.send(data);
                } catch {
                  // Socket closed or closing
                }
              }
            };

            workletNode.port.onmessage = (e: MessageEvent<Float32Array>) => {
              if (ws.readyState !== WebSocket.OPEN) return;

              // When paused (mic muted), don't send any audio to Speechmatics
              // The WebSocket stays alive, we just skip sending packets
              if (isPausedRef.current) return;

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
                    safeSend(float32ToPcm16(downsampled));
                  }
                }
                // Send current chunk immediately
                const downsampled = downsampleBuffer(samples, audioCtx.sampleRate, TARGET_SAMPLE_RATE);
                safeSend(float32ToPcm16(downsampled));
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

                // If the last line is from the same speaker and recent (<8s), extend it
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
            // Server confirmed end — graceful shutdown (don't reconnect)
            isStoppingRef.current = true;
            cleanup();
          }

          if (msg.message === 'Error') {
            console.error('[Speechmatics] Error message:', msg);
            setError(msg.reason || 'Transcription error');
            // Don't cleanup immediately — let onclose handle reconnection
          }
        } catch {
          // Ignore non-JSON messages (e.g. binary acks)
        }
      };

      ws.onerror = (e) => {
        console.error('[Speechmatics] WebSocket error:', e);
        // Don't set error here — let onclose handle reconnection
      };

      ws.onclose = (e) => {
        setIsListening(false);

        // Immediately detach audio worklet callback to stop sending audio to closed socket
        if (workletNodeRef.current) {
          try {
            workletNodeRef.current.port.onmessage = null;
            workletNodeRef.current.disconnect();
          } catch {}
          workletNodeRef.current = null;
        }

        if (isStoppingRef.current) {
          // Intentional stop — don't reconnect
          setConnectionStatus('disconnected');
          return;
        }

        if (e.code === 1000) {
          // Normal close — don't reconnect
          setConnectionStatus('disconnected');
          return;
        }

        // Error 4005 = Speechmatics quota_exceeded (concurrent session limit)
        const isQuota4005 = e.code === 4005 || Boolean(e.reason && e.reason.toLowerCase().includes('quota'));
        if (isQuota4005) {
          console.warn('[Speechmatics] 4005: Concurrent session limit reached. Backing off 10s...');
          setError('Speechmatics concurrent session limit reached. Retrying in 10s...');
        } else {
          console.warn('[Speechmatics] WebSocket closed unexpectedly:', e.code, e.reason);
        }
        attemptReconnect(isQuota4005);
      };
    } catch (err: any) {
      console.error('[useTranscription] connect failed:', err);

      if (isReconnect) {
        // Reconnect attempt failed — try again
        attemptReconnect(false);
      } else {
        setError(err.message || 'Failed to start transcription');
        setConnectionStatus('failed');
        cleanup();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanup, cleanupConnection]);

  /**
   * Attempt to reconnect with exponential backoff.
   * Tears down the old connection and schedules a new connect() call.
   */
  const attemptReconnect = useCallback((isQuota: boolean = false) => {
    if (isStoppingRef.current) return;

    // Clear old health-check timer
    if (healthCheckTimerRef.current) {
      clearInterval(healthCheckTimerRef.current);
      healthCheckTimerRef.current = null;
    }

    reconnectAttemptRef.current += 1;
    const attempt = reconnectAttemptRef.current;

    if (attempt > MAX_RECONNECT_ATTEMPTS) {
      console.error(`[Speechmatics] Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached — giving up`);
      setError('Transcription session ended. Toggle Voice Transcription to reconnect.');
      setConnectionStatus('failed');
      isReconnectingRef.current = false;
      cleanupConnection();
      return;
    }

    isReconnectingRef.current = true;
    setConnectionStatus('reconnecting');
    if (!isQuota) {
      setError(null);
    }

    // If quota 4005 error, wait 10s as officially recommended by Speechmatics documentation
    // Otherwise standard backoff: 1s, 2s, 4s, 8s, 16s
    const delay = isQuota
      ? Math.max(10_000, BASE_RECONNECT_DELAY_MS * Math.pow(2, attempt))
      : BASE_RECONNECT_DELAY_MS * Math.pow(2, attempt - 1);
    console.log(`[Speechmatics] Reconnecting in ${delay}ms (attempt ${attempt}/${MAX_RECONNECT_ATTEMPTS})...`);

    // Tear down old connection resources (but keep mic stream if possible)
    if (wsRef.current) {
      try { wsRef.current.close(); } catch { /* ignore */ }
      wsRef.current = null;
    }
    if (workletNodeRef.current) {
      try {
        workletNodeRef.current.port.onmessage = null;
        workletNodeRef.current.disconnect();
      } catch { /* ignore */ }
      workletNodeRef.current = null;
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch { /* ignore */ }
      audioCtxRef.current = null;
    }

    reconnectTimerRef.current = setTimeout(() => {
      if (isStoppingRef.current) return;
      connect(speakerNameRef.current, true);
    }, delay);
  }, [connect, cleanupConnection]);

  const start = useCallback(async (speakerName?: string) => {
    // If already connected, just resume if paused
    if (isListening && wsRef.current?.readyState === WebSocket.OPEN) {
      speakerNameRef.current = speakerName || 'You';
      if (isPausedRef.current) {
        isPausedRef.current = false;
        setIsPaused(false);
      }
      return;
    }

    // If currently reconnecting, don't start a parallel connection
    if (isReconnectingRef.current) {
      speakerNameRef.current = speakerName || 'You';
      return;
    }

    speakerNameRef.current = speakerName || 'You';
    isStoppingRef.current = false;
    isPausedRef.current = false;
    setIsPaused(false);
    reconnectAttemptRef.current = 0;

    await connect(speakerName || 'You', false);
  }, [isListening, connect]);

  /**
   * Pause audio sending — keeps WebSocket connection alive.
   * Use when mic is muted to avoid burning quota on silence
   * and to avoid the costly reconnection cycle.
   */
  const pause = useCallback(() => {
    isPausedRef.current = true;
    setIsPaused(true);
    setInterimText('');
  }, []);

  /**
   * Resume audio sending after a pause.
   * Use when mic is unmuted.
   */
  const resume = useCallback(() => {
    isPausedRef.current = false;
    setIsPaused(false);
  }, []);

  const stop = useCallback(() => {
    isStoppingRef.current = true;
    cleanup();
    setInterimText('');
  }, [cleanup]);

  return { transcript, interimText, isListening, isPaused, connectionStatus, error, start, pause, resume, stop };
}
