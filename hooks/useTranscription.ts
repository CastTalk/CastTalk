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
 * Audio source:
 *   - Pass the call's own microphone MediaStream to start() so we never open a
 *     second capture of the mic. A second getUserMedia() can mute the published
 *     WebRTC track on mobile browsers (iOS Safari only allows one active capture).
 *   - Falls back to getUserMedia() when no stream is provided.
 *
 * Resilience features:
 *   - One session at a time: overlapping start() calls never open parallel sockets
 *   - Auto-reconnect with exponential backoff on unexpected disconnects (up to 5 retries)
 *   - Health check that only fires when audio was sent but never acknowledged
 *     (silence is expected to be quiet because of VAD, and is not treated as dead)
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
  /** Whether audio sending is paused (connection alive) */
  isPaused: boolean;
  /** Connection status for UI feedback */
  connectionStatus: ConnectionStatus;
  /** Any error that occurred */
  error: string | null;
  /**
   * Start transcription. Safe to call repeatedly: if a session is already running on
   * the same stream it only updates the speaker name. A different stream restarts it.
   */
  start: (speakerName?: string, mediaStream?: MediaStream) => Promise<void>;
  /** Pause audio sending — keeps WebSocket alive */
  pause: () => void;
  /** Resume audio sending — resumes from pause */
  resume: () => void;
  /** Stop transcription — disconnects WebSocket + releases owned mic capture */
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

const hasLiveAudio = (stream: MediaStream | null | undefined) =>
  !!stream && stream.getAudioTracks().some((t) => t.readyState === 'live');

const TARGET_SAMPLE_RATE = 16000;

// Speechmatics WebSocket URL — eu2 region
const SM_WS_BASE = 'wss://eu2.rt.speechmatics.com/v2';

// Reconnection config
const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY_MS = 1000; // 1s, 2s, 4s, 8s, 16s exponential backoff
const HEALTH_CHECK_INTERVAL_MS = 5_000;
// Speechmatics acknowledges every audio chunk with AudioAdded. If audio has been
// sent and nothing came back for this long, the socket is dead.
const ACK_TIMEOUT_MS = 15_000;

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
  // True when streamRef was opened by this hook (we must stop it); false when it
  // belongs to the call's microphone (we must never stop it).
  const ownsStreamRef = useRef(false);
  const externalStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const speakerNameRef = useRef('You');
  const isStoppingRef = useRef(false);
  const isPausedRef = useRef(false);

  // Session bookkeeping
  const isActiveRef = useRef(false); // a session is connecting, open or reconnecting
  const generationRef = useRef(0); // bumped on every stop; stale async work checks it
  const seqNoRef = useRef(0);
  const awaitingAckSinceRef = useRef(0);

  // Reconnection state
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const healthCheckTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const attemptReconnectRef = useRef<(isQuota?: boolean) => void>(() => {});

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

  /** Close the socket + audio graph. Detaches handlers first so no reconnect is triggered. */
  const teardownSocketAndAudio = useCallback(() => {
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ message: 'EndOfStream', last_seq_no: seqNoRef.current }));
        }
        ws.close(1000);
      } catch { /* ignore */ }
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
  }, []);

  /** Tear down WebSocket + audio pipeline + owned mic capture (without triggering reconnect) */
  const cleanupConnection = useCallback(() => {
    teardownSocketAndAudio();

    // Only stop mic tracks we opened ourselves — never the call's microphone
    if (streamRef.current && ownsStreamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    streamRef.current = null;
    ownsStreamRef.current = false;
  }, [teardownSocketAndAudio]);

  /** Full cleanup — tears down everything and resets all state */
  const cleanup = useCallback(() => {
    clearTimers();
    cleanupConnection();
    isActiveRef.current = false;
    reconnectAttemptRef.current = 0;
    setIsListening(false);
    setIsPaused(false);
    isPausedRef.current = false;
    setConnectionStatus('disconnected');
  }, [clearTimers, cleanupConnection]);

  // Auto-cleanup on unmount & page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      isStoppingRef.current = true;
      teardownSocketAndAudio();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      isStoppingRef.current = true;
      generationRef.current += 1;
      cleanup();
    };
  }, [cleanup, teardownSocketAndAudio]);

  /**
   * Core connection logic — called by both start() (initial) and the
   * auto-reconnect mechanism.
   */
  const connect = useCallback(async (isReconnect: boolean = false) => {
    const generation = generationRef.current;
    const isStale = () => generation !== generationRef.current || isStoppingRef.current;

    if (!isReconnect) {
      setError(null);
      setInterimText('');
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
      if (isStale()) return;

      // 2. Resolve the audio source: the call's mic stream if provided, else our own capture
      let stream: MediaStream;
      if (hasLiveAudio(externalStreamRef.current)) {
        stream = externalStreamRef.current!;
        streamRef.current = stream;
        ownsStreamRef.current = false;
      } else if (ownsStreamRef.current && hasLiveAudio(streamRef.current)) {
        stream = streamRef.current!;
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          },
        });
        if (isStale()) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        ownsStreamRef.current = true;
      }

      // 3. Set up AudioContext + AudioWorklet for PCM capture.
      // Use the device's native sample rate (forcing 48kHz breaks on some phones/Firefox);
      // downsampleBuffer converts to 16kHz below.
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      // Contexts created outside a user gesture start "suspended" on mobile — the
      // worklet would then never receive audio.
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume().catch(() => {});
      }

      const workletBlobUrl = URL.createObjectURL(
        new Blob([WORKLET_CODE], { type: 'application/javascript' })
      );
      await audioCtx.audioWorklet.addModule(workletBlobUrl);
      URL.revokeObjectURL(workletBlobUrl);
      if (isStale()) {
        try { audioCtx.close(); } catch { /* ignore */ }
        if (audioCtxRef.current === audioCtx) audioCtxRef.current = null;
        return;
      }

      const source = audioCtx.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioCtx, 'pcm-capture-processor');
      workletNodeRef.current = workletNode;

      source.connect(workletNode);
      // Don't connect to destination — we only want to capture, not play back

      // 4. Open WebSocket to Speechmatics
      const ws = new WebSocket(`${SM_WS_BASE}?jwt=${jwt}`);
      wsRef.current = ws;
      seqNoRef.current = 0;
      awaitingAckSinceRef.current = 0;

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
        if (isStoppingRef.current || wsRef.current !== ws) return;

        // Any message from the server proves the socket is alive
        awaitingAckSinceRef.current = 0;

        try {
          const msg = JSON.parse(event.data as string);

          if (msg.message === 'RecognitionStarted') {
            // Successfully connected — reset reconnect state
            reconnectAttemptRef.current = 0;
            setIsListening(true);
            setConnectionStatus('connected');
            setError(null);

            if (isReconnect) {
              console.log('[Speechmatics] Reconnected successfully');
            }

            // Health check: socket closed, or audio sent but never acknowledged
            if (healthCheckTimerRef.current) clearInterval(healthCheckTimerRef.current);
            healthCheckTimerRef.current = setInterval(() => {
              if (wsRef.current !== ws) return;

              if (ws.readyState !== WebSocket.OPEN) {
                console.warn('[Speechmatics] Health check: WebSocket not open, triggering reconnect');
                attemptReconnectRef.current();
                return;
              }

              const pendingSince = awaitingAckSinceRef.current;
              if (pendingSince > 0 && Date.now() - pendingSince > ACK_TIMEOUT_MS) {
                console.warn('[Speechmatics] Health check: audio not acknowledged — triggering reconnect');
                attemptReconnectRef.current();
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

            const sendAudio = (chunk: Float32Array) => {
              if (ws.readyState !== WebSocket.OPEN) return;
              try {
                ws.send(float32ToPcm16(downsampleBuffer(chunk, audioCtx.sampleRate, TARGET_SAMPLE_RATE)));
                seqNoRef.current += 1;
                if (!awaitingAckSinceRef.current) awaitingAckSinceRef.current = Date.now();
              } catch {
                // Socket closed or closing
              }
            };

            workletNode.port.onmessage = (e: MessageEvent<Float32Array>) => {
              if (ws.readyState !== WebSocket.OPEN) return;

              // When paused, don't send any audio to Speechmatics
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
                  // Waking up from silence: flush pre-roll chunks (includes the current one)
                  isSilentMode = false;
                  while (preRollChunks.length > 0) {
                    sendAudio(preRollChunks.shift()!);
                  }
                } else {
                  sendAudio(samples);
                }
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
            if (partialText && /[a-zA-Z0-9À-ɏḀ-ỿ]/.test(partialText)) {
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
            if (finalText && /[a-zA-Z0-9À-ɏḀ-ỿ]/.test(finalText)) {
              setInterimText('');
              // Notify callback
              optionsRef.current?.onTranscript?.({
                text: finalText,
                speaker: speakerNameRef.current,
                isPartial: false,
              });

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
        // Ignore close events from a socket we've already replaced
        if (wsRef.current !== ws) return;
        setIsListening(false);

        if (isStoppingRef.current || e.code === 1000) {
          // Intentional stop or normal close — don't reconnect
          cleanup();
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
        attemptReconnectRef.current(isQuota4005);
      };
    } catch (err: any) {
      if (isStale()) return;
      console.error('[useTranscription] connect failed:', err);

      if (isReconnect) {
        // Reconnect attempt failed — try again
        attemptReconnectRef.current(false);
      } else {
        setError(err.message || 'Failed to start transcription');
        cleanup();
        setConnectionStatus('failed');
      }
    }
  }, [cleanup]);

  /**
   * Attempt to reconnect with exponential backoff.
   * Tears down the old connection and schedules a new connect() call.
   */
  const attemptReconnect = useCallback((isQuota: boolean = false) => {
    if (isStoppingRef.current) return;
    // A reconnect is already scheduled — don't stack a second one
    if (reconnectTimerRef.current) return;

    if (healthCheckTimerRef.current) {
      clearInterval(healthCheckTimerRef.current);
      healthCheckTimerRef.current = null;
    }

    reconnectAttemptRef.current += 1;
    const attempt = reconnectAttemptRef.current;

    if (attempt > MAX_RECONNECT_ATTEMPTS) {
      console.error(`[Speechmatics] Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached — giving up`);
      cleanup();
      setError('Transcription session ended. Toggle Voice Transcription to reconnect.');
      setConnectionStatus('failed');
      return;
    }

    setIsListening(false);
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

    // Tear down old connection resources (keeps the mic stream)
    teardownSocketAndAudio();

    const generation = generationRef.current;
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      if (isStoppingRef.current || generation !== generationRef.current) return;
      connect(true);
    }, delay);
  }, [connect, cleanup, teardownSocketAndAudio]);

  useEffect(() => {
    attemptReconnectRef.current = attemptReconnect;
  }, [attemptReconnect]);

  const stop = useCallback(() => {
    isStoppingRef.current = true;
    generationRef.current += 1;
    cleanup();
    setInterimText('');
  }, [cleanup]);

  const start = useCallback(async (speakerName?: string, mediaStream?: MediaStream) => {
    speakerNameRef.current = speakerName || 'You';
    const nextStream = mediaStream ?? null;

    // Already running on the same audio source — just keep the new speaker name.
    // This guard is what prevents duplicate Speechmatics sessions (each one counts
    // against the account's concurrent-session limit).
    if (isActiveRef.current && externalStreamRef.current === nextStream) {
      return;
    }

    // Audio source changed (e.g. mic device switched) — restart cleanly
    if (isActiveRef.current) {
      stop();
    }

    externalStreamRef.current = nextStream;
    isActiveRef.current = true;
    isStoppingRef.current = false;
    isPausedRef.current = false;
    setIsPaused(false);
    reconnectAttemptRef.current = 0;

    await connect(false);
  }, [connect, stop]);

  /** Pause audio sending — keeps WebSocket connection alive. */
  const pause = useCallback(() => {
    isPausedRef.current = true;
    setIsPaused(true);
    setInterimText('');
  }, []);

  /** Resume audio sending after a pause. */
  const resume = useCallback(() => {
    isPausedRef.current = false;
    setIsPaused(false);
  }, []);

  return { transcript, interimText, isListening, isPaused, connectionStatus, error, start, pause, resume, stop };
}
