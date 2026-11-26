'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Speechmatics real-time transcription hook for Taglish (Tagalog + English).
 *
 * Uses the raw WebSocket protocol (no SDK dependency).
 *
 * Sessions are opened on demand. The Speechmatics account allows only a few
 * concurrent real-time sessions across ALL meetings, so holding one open for
 * every unmuted participant breaks as soon as a third person joins. Instead:
 *   - start() only "arms" the hook: it taps the mic stream and runs a local voice
 *     detector. No Speechmatics session is open yet.
 *   - When the user starts talking, a session is opened. Audio captured while it
 *     connects (plus ~0.5s of pre-roll before speech was detected) is buffered and
 *     sent once recognition starts, so the first words are not lost.
 *   - After IDLE_CLOSE_MS of silence the session is closed gracefully, freeing the
 *     slot for whoever speaks next.
 *   - If the account limit is hit (4005), the hook waits quietly and retries on the
 *     next speech instead of looping reconnects and error toasts.
 *
 * Audio path:
 *   - Uses the call's own microphone MediaStream when passed to start(), so we never
 *     open a second capture (that can silence the published mic on phones).
 *   - The worklet batches ~2048 samples per message; audio is resampled to 16kHz with
 *     a stateful box-filter resampler (exact rate, basic anti-aliasing) and sent to
 *     Speechmatics in 100ms frames instead of one message per 128-sample block.
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
  /** Whether the hook is armed and listening for speech */
  isListening: boolean;
  /** Whether audio sending is paused */
  isPaused: boolean;
  /** Connection status for UI feedback ('connected' = armed and ready) */
  connectionStatus: ConnectionStatus;
  /** Any error that occurred */
  error: string | null;
  /**
   * Arm transcription. Safe to call repeatedly: if already armed on the same stream it
   * only updates the speaker name. A different stream restarts it.
   */
  start: (speakerName?: string, mediaStream?: MediaStream) => Promise<void>;
  /** Pause audio sending */
  pause: () => void;
  /** Resume audio sending */
  resume: () => void;
  /** Stop transcription — closes any session, the audio graph and owned mic capture */
  stop: () => void;
}

// AudioWorklet processor: batches render quanta (128 samples) into larger chunks so
// the main thread gets ~20 messages/s instead of ~375.
const WORKLET_CODE = `
class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(2048);
    this.length = 0;
  }
  process(inputs) {
    const input = inputs[0];
    const channel = input && input[0];
    if (channel && channel.length > 0) {
      if (this.length + channel.length > this.buffer.length) {
        this.port.postMessage(this.buffer.slice(0, this.length));
        this.length = 0;
      }
      this.buffer.set(channel, this.length);
      this.length += channel.length;
      if (this.length >= this.buffer.length) {
        this.port.postMessage(this.buffer.slice(0, this.length));
        this.length = 0;
      }
    }
    return true;
  }
}
registerProcessor('pcm-capture-processor', PcmCaptureProcessor);
`;

/** Convert Float32 samples to Int16 PCM little-endian (Speechmatics `pcm_s16le`). */
function float32ToPcm16(float32: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

/**
 * Stateful downsampler. Keeps the fractional read position and leftover samples
 * between chunks so the output rate is exact, and averages the input samples that
 * fall into each output sample (a box filter) to reduce aliasing.
 */
class Downsampler {
  private carry = new Float32Array(0);
  private pos = 0;

  constructor(private readonly ratio: number) {}

  process(input: Float32Array): Float32Array {
    if (this.ratio === 1) return input;

    const buf = new Float32Array(this.carry.length + input.length);
    buf.set(this.carry);
    buf.set(input, this.carry.length);

    const out = new Float32Array(Math.floor((buf.length - this.pos) / this.ratio) + 1);
    let n = 0;
    while (this.pos + this.ratio <= buf.length) {
      const startIdx = Math.floor(this.pos);
      const endIdx = Math.max(startIdx + 1, Math.floor(this.pos + this.ratio));
      let sum = 0;
      for (let i = startIdx; i < endIdx; i++) sum += buf[i];
      out[n++] = sum / (endIdx - startIdx);
      this.pos += this.ratio;
    }

    const consumed = Math.floor(this.pos);
    this.carry = buf.slice(consumed);
    this.pos -= consumed;
    return out.subarray(0, n);
  }
}

const hasLiveAudio = (stream: MediaStream | null | undefined) =>
  !!stream && stream.getAudioTracks().some((t) => t.readyState === 'live');

const TARGET_SAMPLE_RATE = 16000;
const FRAME_MS = 100;

// Speechmatics WebSocket URL — eu2 region
const SM_WS_BASE = 'wss://eu2.rt.speechmatics.com/v2';

// Voice detection
const VAD_THRESHOLD = 0.006; // RMS of a worklet chunk counted as speech
const SPEECH_CHUNKS_TO_OPEN = 2; // consecutive speech chunks (~85ms) before opening a session
const PRE_ROLL_MS = 500; // audio kept from before speech was detected
const MAX_BACKLOG_MS = 10_000; // audio buffered while a session connects
const IDLE_CLOSE_MS = 15_000; // silence after which the session is released

// Failure handling
const QUOTA_COOLDOWN_MS = 10_000; // Speechmatics' recommended wait after 4005
const MAX_CONSECUTIVE_FAILURES = 5;
const ACK_TIMEOUT_MS = 15_000; // audio sent but not acknowledged → socket is dead
const HEALTH_CHECK_INTERVAL_MS = 5_000;

type Phase = 'idle' | 'connecting' | 'open' | 'closing';

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

  // Audio graph (lives while armed)
  const streamRef = useRef<MediaStream | null>(null);
  const ownsStreamRef = useRef(false); // true when we opened the capture ourselves
  const externalStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const removeGestureListenersRef = useRef<(() => void) | null>(null);

  const speakerNameRef = useRef('You');
  const isPausedRef = useRef(false);
  const isArmedRef = useRef(false);
  const generationRef = useRef(0); // bumped on every stop; stale async work checks it

  // Session state
  const wsRef = useRef<WebSocket | null>(null);
  const phaseRef = useRef<Phase>('idle');
  const seqNoRef = useRef(0);
  const awaitingAckSinceRef = useRef(0);
  const backlogRef = useRef<Float32Array[]>([]);
  const preRollRef = useRef<Float32Array[]>([]);
  const lastSpeechAtRef = useRef(0);
  const speechChunksRef = useRef(0);
  const cooldownUntilRef = useRef(0);
  const failuresRef = useRef(0);
  const reopenAfterCloseRef = useRef(false);
  const healthTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Frame assembly
  const outputRateRef = useRef(TARGET_SAMPLE_RATE);
  const frameSamplesRef = useRef(TARGET_SAMPLE_RATE / 10);
  const frameBufRef = useRef<Float32Array>(new Float32Array(TARGET_SAMPLE_RATE / 10));
  const frameLenRef = useRef(0);
  const downsamplerRef = useRef<Downsampler | null>(null);

  const openSessionRef = useRef<() => void>(() => {});

  const clearHealthTimer = () => {
    if (healthTimerRef.current) {
      clearInterval(healthTimerRef.current);
      healthTimerRef.current = null;
    }
  };

  /** Drop the socket without any graceful handshake (handlers detached first). */
  const dropSocket = useCallback(() => {
    clearHealthTimer();
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
    phaseRef.current = 'idle';
  }, []);

  /** Tear down the audio graph and any capture we own. */
  const teardownAudio = useCallback(() => {
    removeGestureListenersRef.current?.();
    removeGestureListenersRef.current = null;

    if (workletNodeRef.current) {
      try {
        workletNodeRef.current.port.onmessage = null;
        workletNodeRef.current.disconnect();
      } catch { /* ignore */ }
      workletNodeRef.current = null;
    }
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.disconnect(); } catch { /* ignore */ }
      sourceNodeRef.current = null;
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch { /* ignore */ }
      audioCtxRef.current = null;
    }
    if (streamRef.current && ownsStreamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    streamRef.current = null;
    ownsStreamRef.current = false;
  }, []);

  const resetBuffers = () => {
    backlogRef.current = [];
    preRollRef.current = [];
    frameLenRef.current = 0;
    speechChunksRef.current = 0;
    reopenAfterCloseRef.current = false;
  };

  const sendFrame = (ws: WebSocket, frame: Float32Array) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(float32ToPcm16(frame));
      seqNoRef.current += 1;
      if (!awaitingAckSinceRef.current) awaitingAckSinceRef.current = Date.now();
    } catch { /* socket closing */ }
  };

  const pushBounded = (list: Float32Array[], frame: Float32Array, maxFrames: number) => {
    list.push(frame);
    if (list.length > maxFrames) list.splice(0, list.length - maxFrames);
  };

  /** Route one 100ms frame according to the session phase. */
  const handleFrame = useCallback((frame: Float32Array) => {
    const now = Date.now();
    const speechRecently = now - lastSpeechAtRef.current < 1_000;
    const preRollFrames = Math.ceil(PRE_ROLL_MS / FRAME_MS);
    const maxBacklogFrames = Math.ceil(MAX_BACKLOG_MS / FRAME_MS);

    switch (phaseRef.current) {
      case 'open': {
        const ws = wsRef.current;
        if (ws) sendFrame(ws, frame);
        if (now - lastSpeechAtRef.current > IDLE_CLOSE_MS && ws && ws.readyState === WebSocket.OPEN) {
          // Release the session slot; finals still arrive before EndOfTranscript
          phaseRef.current = 'closing';
          try {
            ws.send(JSON.stringify({ message: 'EndOfStream', last_seq_no: seqNoRef.current }));
          } catch { /* ignore */ }
        }
        return;
      }
      case 'connecting':
        pushBounded(backlogRef.current, frame, maxBacklogFrames);
        return;
      case 'closing':
        if (reopenAfterCloseRef.current || speechRecently) {
          if (!reopenAfterCloseRef.current) {
            reopenAfterCloseRef.current = true;
            backlogRef.current = [...preRollRef.current];
          }
          pushBounded(backlogRef.current, frame, maxBacklogFrames);
        } else {
          pushBounded(preRollRef.current, frame, preRollFrames);
        }
        return;
      case 'idle':
      default:
        // lastSpeechAt is only set after SPEECH_CHUNKS_TO_OPEN consecutive speech
        // chunks, so a single click or bump does not open a session.
        if (speechRecently && now >= cooldownUntilRef.current) {
          backlogRef.current = [...preRollRef.current, frame];
          preRollRef.current = [];
          openSessionRef.current();
        } else {
          pushBounded(preRollRef.current, frame, preRollFrames);
        }
    }
  }, []);

  /** Worklet audio → VAD → resample → 100ms frames. */
  const handleAudioChunk = useCallback((samples: Float32Array) => {
    if (!isArmedRef.current || !samples?.length) return;

    // While paused, feed silence: nothing is transcribed, and the idle timer still
    // releases the session.
    if (isPausedRef.current) samples = new Float32Array(samples.length);

    let sum = 0;
    for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
    const rms = Math.sqrt(sum / samples.length);
    if (rms >= VAD_THRESHOLD) {
      speechChunksRef.current += 1;
      if (speechChunksRef.current >= SPEECH_CHUNKS_TO_OPEN) lastSpeechAtRef.current = Date.now();
    } else {
      speechChunksRef.current = 0;
    }

    const resampled = downsamplerRef.current ? downsamplerRef.current.process(samples) : samples;
    const frameSize = frameSamplesRef.current;
    let offset = 0;
    while (offset < resampled.length) {
      const take = Math.min(frameSize - frameLenRef.current, resampled.length - offset);
      frameBufRef.current.set(resampled.subarray(offset, offset + take), frameLenRef.current);
      frameLenRef.current += take;
      offset += take;
      if (frameLenRef.current === frameSize) {
        handleFrame(frameBufRef.current.slice());
        frameLenRef.current = 0;
      }
    }
  }, [handleFrame]);

  /** Called when a socket ends for any reason. Decides whether to reopen. */
  const onSessionEnded = useCallback((opts: { quota?: boolean; failed?: boolean }) => {
    dropSocket();
    setInterimText('');
    if (!isArmedRef.current) return;

    if (opts.quota) {
      failuresRef.current += 1;
      cooldownUntilRef.current = Date.now() + QUOTA_COOLDOWN_MS;
      backlogRef.current = [];
      reopenAfterCloseRef.current = false;
      setConnectionStatus('reconnecting');
      setError((prev) => prev ?? 'Caption capacity is full right now. Captions will resume automatically.');
      return;
    }

    if (opts.failed) {
      failuresRef.current += 1;
      const backoff = Math.min(30_000, 1_000 * 2 ** (failuresRef.current - 1));
      cooldownUntilRef.current = Date.now() + backoff;
      backlogRef.current = [];
      reopenAfterCloseRef.current = false;
      if (failuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
        setConnectionStatus('failed');
        setError('Captions could not connect. They will retry the next time you speak.');
      } else {
        setConnectionStatus('reconnecting');
      }
      return;
    }

    // Graceful close (idle). Reopen right away if speech started while closing.
    if (reopenAfterCloseRef.current) {
      reopenAfterCloseRef.current = false;
      openSessionRef.current();
    }
  }, [dropSocket]);

  /** Open a Speechmatics session and flush the backlog once recognition starts. */
  const openSession = useCallback(async () => {
    if (phaseRef.current === 'connecting' || phaseRef.current === 'open') return;
    phaseRef.current = 'connecting';
    const generation = generationRef.current;
    const isStale = () => generation !== generationRef.current || !isArmedRef.current;

    try {
      const tokenRes = await fetch('/api/speechmatics/token', { method: 'POST' });
      if (!tokenRes.ok) {
        const body = await tokenRes.json().catch(() => ({}));
        throw new Error(body.error || `Token request failed (${tokenRes.status})`);
      }
      const { jwt } = await tokenRes.json();
      if (!jwt) throw new Error('No JWT returned from token endpoint');
      if (isStale()) return;

      const ws = new WebSocket(`${SM_WS_BASE}?jwt=${encodeURIComponent(jwt)}`);
      wsRef.current = ws;
      seqNoRef.current = 0;
      awaitingAckSinceRef.current = 0;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            message: 'StartRecognition',
            audio_format: {
              type: 'raw',
              encoding: 'pcm_s16le',
              sample_rate: outputRateRef.current,
            },
            transcription_config: {
              language: 'tl', // Tagalog & English bilingual pack
              operating_point: 'standard',
              max_delay: 0.7,
              max_delay_mode: 'flexible',
              enable_partials: true,
            },
          })
        );
      };

      ws.onmessage = (event) => {
        if (wsRef.current !== ws) return;
        awaitingAckSinceRef.current = 0; // any message proves the socket is alive

        let msg: any;
        try {
          msg = JSON.parse(event.data as string);
        } catch {
          return;
        }

        switch (msg.message) {
          case 'RecognitionStarted': {
            phaseRef.current = 'open';
            failuresRef.current = 0;
            cooldownUntilRef.current = 0;
            setConnectionStatus('connected');
            setError(null);

            const backlog = backlogRef.current;
            backlogRef.current = [];
            backlog.forEach((frame) => sendFrame(ws, frame));

            clearHealthTimer();
            healthTimerRef.current = setInterval(() => {
              if (wsRef.current !== ws) return;
              const pendingSince = awaitingAckSinceRef.current;
              if (ws.readyState !== WebSocket.OPEN || (pendingSince > 0 && Date.now() - pendingSince > ACK_TIMEOUT_MS)) {
                console.warn('[Speechmatics] Session unresponsive — dropping it');
                onSessionEnded({ failed: true });
              }
            }, HEALTH_CHECK_INTERVAL_MS);
            break;
          }

          case 'AddPartialTranscript': {
            const partialText = (msg.results || [])
              .map((r: any) => r.alternatives?.[0]?.content || '')
              .join(' ')
              .trim();
            if (partialText && /[a-zA-Z0-9À-ɏḀ-ỿ]/.test(partialText)) {
              setInterimText(partialText);
              optionsRef.current?.onTranscript?.({
                text: partialText,
                speaker: speakerNameRef.current,
                isPartial: true,
              });
            }
            break;
          }

          case 'AddTranscript': {
            const finalText = (msg.results || [])
              .map((r: any) => r.alternatives?.[0]?.content || '')
              .join(' ')
              .trim();
            if (finalText && /[a-zA-Z0-9À-ɏḀ-ỿ]/.test(finalText)) {
              setInterimText('');
              optionsRef.current?.onTranscript?.({
                text: finalText,
                speaker: speakerNameRef.current,
                isPartial: false,
              });
              setTranscript((prev) => {
                const lastLine = prev[prev.length - 1];
                const now = Date.now();
                if (lastLine && lastLine.speaker === speakerNameRef.current && now - lastLine.timestamp < 8000) {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    ...lastLine,
                    text: `${lastLine.text} ${finalText}`,
                    timestamp: now,
                  };
                  return updated;
                }
                return [...prev, { speaker: speakerNameRef.current, text: finalText, timestamp: now }];
              });
            }
            break;
          }

          case 'EndOfTranscript':
            // Graceful end after our EndOfStream (idle release)
            onSessionEnded({});
            break;

          case 'Error': {
            console.error('[Speechmatics] Error message:', msg);
            const isQuota = msg.type === 'quota_exceeded';
            onSessionEnded(isQuota ? { quota: true } : { failed: true });
            break;
          }
        }
      };

      ws.onerror = (e) => {
        console.warn('[Speechmatics] WebSocket error:', e);
        // onclose follows and decides what to do
      };

      ws.onclose = (e) => {
        if (wsRef.current !== ws) return;
        const isQuota = e.code === 4005 || Boolean(e.reason && e.reason.toLowerCase().includes('quota'));
        if (isQuota) {
          console.warn('[Speechmatics] 4005: concurrent session limit reached — waiting before retry');
          onSessionEnded({ quota: true });
        } else if (phaseRef.current === 'closing' || e.code === 1000) {
          onSessionEnded({});
        } else {
          console.warn('[Speechmatics] WebSocket closed unexpectedly:', e.code, e.reason);
          onSessionEnded({ failed: true });
        }
      };
    } catch (err: any) {
      if (isStale()) return;
      console.error('[useTranscription] session open failed:', err);
      onSessionEnded({ failed: true });
    }
  }, [onSessionEnded]);

  useEffect(() => {
    openSessionRef.current = () => { void openSession(); };
  }, [openSession]);

  const stop = useCallback(() => {
    generationRef.current += 1;
    isArmedRef.current = false;
    dropSocket();
    teardownAudio();
    resetBuffers();
    failuresRef.current = 0;
    cooldownUntilRef.current = 0;
    isPausedRef.current = false;
    setIsPaused(false);
    setIsListening(false);
    setInterimText('');
    setConnectionStatus('disconnected');
  }, [dropSocket, teardownAudio]);

  const start = useCallback(async (speakerName?: string, mediaStream?: MediaStream) => {
    speakerNameRef.current = speakerName || 'You';
    const nextStream = mediaStream ?? null;

    // Already armed on the same audio source — just keep the new speaker name
    if (isArmedRef.current && externalStreamRef.current === nextStream) return;

    // Audio source changed (e.g. mic device switched) — restart cleanly
    if (isArmedRef.current) stop();

    externalStreamRef.current = nextStream;
    isArmedRef.current = true;
    const generation = generationRef.current;
    const isStale = () => generation !== generationRef.current || !isArmedRef.current;

    setError(null);
    setInterimText('');
    setConnectionStatus('connecting');

    try {
      let stream: MediaStream;
      if (hasLiveAudio(nextStream)) {
        stream = nextStream!;
        ownsStreamRef.current = false;
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
        });
        if (isStale()) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        ownsStreamRef.current = true;
      }
      streamRef.current = stream;

      // Native sample rate (forcing one breaks on some phones/Firefox); we downsample.
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;

      // Contexts created outside a user gesture start "suspended" on mobile. Retry on
      // the next tap/key press if resume() is refused.
      if (audioCtx.state === 'suspended') await audioCtx.resume().catch(() => {});
      if (audioCtx.state === 'suspended') {
        const resumeOnGesture = () => {
          if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
        };
        const types = ['pointerdown', 'touchend', 'keydown'];
        types.forEach((type) => document.addEventListener(type, resumeOnGesture, { capture: true }));
        removeGestureListenersRef.current = () =>
          types.forEach((type) => document.removeEventListener(type, resumeOnGesture, { capture: true }));
      }

      const workletBlobUrl = URL.createObjectURL(new Blob([WORKLET_CODE], { type: 'application/javascript' }));
      try {
        await audioCtx.audioWorklet.addModule(workletBlobUrl);
      } finally {
        URL.revokeObjectURL(workletBlobUrl);
      }
      if (isStale()) return;

      const nativeRate = audioCtx.sampleRate;
      const outputRate = nativeRate > TARGET_SAMPLE_RATE ? TARGET_SAMPLE_RATE : nativeRate;
      outputRateRef.current = outputRate;
      downsamplerRef.current = outputRate === nativeRate ? null : new Downsampler(nativeRate / outputRate);
      frameSamplesRef.current = Math.round((outputRate * FRAME_MS) / 1000);
      frameBufRef.current = new Float32Array(frameSamplesRef.current);
      resetBuffers();

      const source = audioCtx.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioCtx, 'pcm-capture-processor');
      sourceNodeRef.current = source;
      workletNodeRef.current = workletNode;
      workletNode.port.onmessage = (e: MessageEvent<Float32Array>) => handleAudioChunk(e.data);
      source.connect(workletNode); // capture only — not connected to the destination

      setIsListening(true);
      setConnectionStatus('connected');
    } catch (err: any) {
      if (isStale()) return;
      console.error('[useTranscription] start failed:', err);
      stop();
      setError(err?.message || 'Failed to start transcription');
      setConnectionStatus('failed');
    }
  }, [stop, handleAudioChunk]);

  // Cleanup on unmount & page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      isArmedRef.current = false;
      dropSocket();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      stop();
    };
  }, [stop, dropSocket]);

  /** Pause audio sending (session is released by the idle timer). */
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
