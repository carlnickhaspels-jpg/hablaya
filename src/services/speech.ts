import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

/**
 * Speech service: MediaRecorder + Whisper for transcription, plus continuous
 * Voice Activity Detection (VAD) for hands-free conversation mode.
 */

export interface TranscriptionResult {
  text: string;
  uncertainSegments?: string[];
  detectedLanguage?: string;
}

let mediaRecorder: any = null;
let audioChunks: Blob[] = [];
let resolveRecording: ((result: TranscriptionResult) => void) | null = null;
let rejectRecording: ((err: Error) => void) | null = null;
let isRecording = false;
let activeMimeType = '';

// Continuous mode state
let conversationStream: MediaStream | null = null;
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let vadAnimationFrame: number | null = null;
let conversationActive = false;

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/aac',
    'audio/ogg;codecs=opus',
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return '';
}

// ── One-shot recording (push-to-talk) ───────────────────────────────────────

export async function startRecording(): Promise<void> {
  if (Platform.OS !== 'web') return;
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone API not available in this browser.');
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    await beginRecording(stream);
  } catch (err: any) {
    isRecording = false;
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      throw new Error('Microphone permission denied. Please allow microphone access.');
    }
    if (err.name === 'NotFoundError') {
      throw new Error('No microphone found on this device.');
    }
    throw new Error(err.message || 'Failed to start recording');
  }
}

async function beginRecording(stream: MediaStream): Promise<void> {
  audioChunks = [];
  activeMimeType = pickMimeType();

  const options: any = activeMimeType ? { mimeType: activeMimeType } : {};
  mediaRecorder = new MediaRecorder(stream, options);

  mediaRecorder.ondataavailable = (event: any) => {
    if (event.data && event.data.size > 0) audioChunks.push(event.data);
  };

  mediaRecorder.onstop = async () => {
    // Only stop tracks if we're in one-shot mode (continuous mode keeps the stream)
    if (!conversationActive) {
      stream.getTracks().forEach((t) => t.stop());
    }

    const totalSize = audioChunks.reduce((sum, c) => sum + c.size, 0);
    console.log(`[Speech] Recording stopped. Bytes: ${totalSize}`);

    if (totalSize < 1000) {
      if (rejectRecording) {
        rejectRecording(new Error('No audio captured.'));
        resolveRecording = null;
        rejectRecording = null;
      }
      return;
    }

    const audioBlob = new Blob(audioChunks, { type: activeMimeType || 'audio/webm' });

    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: audioBlob,
        headers: { 'Content-Type': activeMimeType || 'audio/webm' },
      });
      const data = await response.json();
      console.log('[Speech] Transcription:', data);

      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      const text = (data.text || '').trim();

      if (resolveRecording) {
        if (text) {
          resolveRecording({
            text,
            uncertainSegments: data.uncertainSegments || [],
            detectedLanguage: data.detectedLanguage,
          });
        } else if (rejectRecording) {
          rejectRecording(new Error('No speech detected.'));
        }
        resolveRecording = null;
        rejectRecording = null;
      }
    } catch (err: any) {
      console.error('[Speech] Transcription error:', err);
      if (rejectRecording) {
        rejectRecording(new Error(err.message || 'Transcription failed'));
        resolveRecording = null;
        rejectRecording = null;
      }
    }
  };

  mediaRecorder.onerror = (event: any) => {
    console.error('[Speech] MediaRecorder error:', event.error);
    if (rejectRecording) {
      rejectRecording(new Error('Recording failed'));
      resolveRecording = null;
      rejectRecording = null;
    }
  };

  mediaRecorder.start(250);
  isRecording = true;
  console.log(`[Speech] Recording started (mime: ${activeMimeType})`);
}

export async function stopRecording(): Promise<TranscriptionResult> {
  return new Promise<TranscriptionResult>((resolve, reject) => {
    if (!mediaRecorder || !isRecording) {
      reject(new Error('No active recording'));
      return;
    }
    resolveRecording = resolve;
    rejectRecording = reject;
    isRecording = false;

    try {
      if (typeof mediaRecorder.requestData === 'function') {
        try { mediaRecorder.requestData(); } catch {}
      }
      setTimeout(() => {
        try { mediaRecorder.stop(); } catch (err: any) {
          if (rejectRecording) {
            rejectRecording(new Error('Failed to stop recording'));
            resolveRecording = null;
            rejectRecording = null;
          }
        }
      }, 100);
    } catch (err: any) {
      reject(new Error('Failed to stop recording'));
      resolveRecording = null;
      rejectRecording = null;
    }
  });
}

// ── Continuous conversation mode (VAD) ──────────────────────────────────────

export interface ConversationCallbacks {
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  onTranscript?: (result: TranscriptionResult) => void;
  onError?: (err: Error) => void;
  onLevel?: (level: number) => void; // 0..1 audio level for visualization
}

interface VadConfig {
  threshold: number;        // Volume above which we consider it "speech" (0..1)
  silenceMs: number;        // How many ms of silence before we stop
  minSpeechMs: number;      // Minimum speech duration to send
  maxSpeechMs: number;      // Maximum speech duration before forcing stop
}

const DEFAULT_VAD: VadConfig = {
  threshold: 0.035,    // require louder voice to count as speech
  silenceMs: 1500,     // wait 1.5s of silence before sending
  minSpeechMs: 900,    // require nearly a full second of voice (filters out clicks/short noise)
  maxSpeechMs: 15000,
};

export async function startConversation(callbacks: ConversationCallbacks): Promise<void> {
  if (Platform.OS !== 'web') {
    callbacks.onError?.(new Error('Conversation mode only works in web browsers.'));
    return;
  }

  if (conversationActive) {
    console.log('[Speech] Conversation already active');
    return;
  }

  // Stop any TTS that may still be playing before we open the mic,
  // otherwise the mic will pick up the AI's own voice.
  await stopAudio();
  // Small grace period for audio output to actually stop
  await new Promise((r) => setTimeout(r, 300));

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    conversationStream = stream;
    conversationActive = true;

    // Set up Web Audio API for level monitoring
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    audioContext = new AudioCtx();
    if (audioContext!.state === 'suspended') await audioContext!.resume();

    const source = audioContext!.createMediaStreamSource(stream);
    analyser = audioContext!.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.5;
    source.connect(analyser);

    // VAD state
    let speaking = false;
    let speechStartedAt = 0;
    let lastVoiceAt = 0;
    let pendingTranscription = false;
    let pauseListening = false; // pause during transcription/playback
    const startedAt = performance.now();
    const WARMUP_MS = 500; // ignore VAD events for first 500ms to skip click/touch noise

    const buffer = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      if (!conversationActive || !analyser) return;

      analyser.getByteTimeDomainData(buffer);
      // Compute RMS
      let sum = 0;
      for (let i = 0; i < buffer.length; i++) {
        const v = (buffer[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buffer.length);

      callbacks.onLevel?.(Math.min(1, rms * 4));

      const now = performance.now();
      const isVoice = rms > DEFAULT_VAD.threshold;

      // Warm-up: ignore everything during the first WARMUP_MS so the click
      // sound from tapping the mic button doesn't trigger a recording.
      if (now - startedAt < WARMUP_MS) {
        vadAnimationFrame = requestAnimationFrame(tick);
        return;
      }

      if (!pauseListening && !pendingTranscription) {
        if (isVoice) {
          lastVoiceAt = now;
          if (!speaking) {
            speaking = true;
            speechStartedAt = now;
            // Start recording
            beginRecording(conversationStream!).catch((err) => {
              callbacks.onError?.(err);
            });
            callbacks.onSpeechStart?.();
          } else if (now - speechStartedAt > DEFAULT_VAD.maxSpeechMs) {
            // Force stop if too long
            speaking = false;
            pendingTranscription = true;
            stopAndTranscribe();
          }
        } else if (speaking) {
          const silenceFor = now - lastVoiceAt;
          const speechDuration = now - speechStartedAt;
          if (silenceFor > DEFAULT_VAD.silenceMs && speechDuration > DEFAULT_VAD.minSpeechMs) {
            speaking = false;
            pendingTranscription = true;
            stopAndTranscribe();
          } else if (silenceFor > DEFAULT_VAD.silenceMs && speechDuration <= DEFAULT_VAD.minSpeechMs) {
            // Too short — discard
            speaking = false;
            try { mediaRecorder?.stop(); } catch {}
            audioChunks = [];
            isRecording = false;
          }
        }
      }

      vadAnimationFrame = requestAnimationFrame(tick);
    };

    const stopAndTranscribe = async () => {
      callbacks.onSpeechEnd?.();
      try {
        const result = await stopRecording();
        if (result && result.text && result.text.trim()) {
          callbacks.onTranscript?.(result);
        }
      } catch (err: any) {
        console.warn('[Speech] VAD stop error:', err.message);
      } finally {
        pendingTranscription = false;
        speaking = false;
      }
    };

    // Helper to pause/resume from outside
    (startConversation as any)._pause = () => { pauseListening = true; };
    (startConversation as any)._resume = () => {
      pauseListening = false;
      lastVoiceAt = performance.now();
    };

    tick();
    console.log('[Speech] Conversation mode started');
  } catch (err: any) {
    conversationActive = false;
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      callbacks.onError?.(new Error('Microphone permission denied. Please allow microphone access.'));
    } else {
      callbacks.onError?.(new Error(err.message || 'Failed to start conversation mode'));
    }
  }
}

export function pauseConversation(): void {
  const pause = (startConversation as any)._pause;
  if (typeof pause === 'function') pause();
}

export function resumeConversation(): void {
  const resume = (startConversation as any)._resume;
  if (typeof resume === 'function') resume();
}

export async function stopConversation(): Promise<void> {
  conversationActive = false;
  if (vadAnimationFrame !== null) {
    cancelAnimationFrame(vadAnimationFrame);
    vadAnimationFrame = null;
  }
  if (mediaRecorder && isRecording) {
    try { mediaRecorder.stop(); } catch {}
    isRecording = false;
  }
  if (conversationStream) {
    conversationStream.getTracks().forEach((t) => t.stop());
    conversationStream = null;
  }
  if (audioContext) {
    try { await audioContext.close(); } catch {}
    audioContext = null;
  }
  analyser = null;
  console.log('[Speech] Conversation mode stopped');
}

export function isConversationActive(): boolean {
  return conversationActive;
}

// ── Text-to-Speech ──────────────────────────────────────────────────────────
// Uses OpenAI TTS via /api/tts for high-quality multilingual voice
// (handles Spanish + Dutch in one utterance). Falls back to expo-speech
// if the server endpoint fails.

let currentAudioElement: HTMLAudioElement | null = null;
let currentAudioUrl: string | null = null;

export async function playAudio(text: string): Promise<void> {
  if (!text || !text.trim()) return;

  // Stop any in-flight audio first
  await stopAudio();

  if (Platform.OS === 'web' && typeof Audio !== 'undefined') {
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: 'nova' }),
      });

      if (!response.ok) {
        console.warn('[TTS] Server returned', response.status, '— falling back to browser TTS');
        return playWithBrowserTTS(text);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      currentAudioUrl = url;

      const audio = new Audio(url);
      currentAudioElement = audio;

      return new Promise<void>((resolve) => {
        audio.onended = () => {
          if (currentAudioUrl === url) {
            URL.revokeObjectURL(url);
            currentAudioUrl = null;
            currentAudioElement = null;
          }
          resolve();
        };
        audio.onerror = () => {
          console.warn('[TTS] Audio playback error, falling back');
          if (currentAudioUrl === url) {
            URL.revokeObjectURL(url);
            currentAudioUrl = null;
            currentAudioElement = null;
          }
          // Fallback to browser TTS
          playWithBrowserTTS(text).then(resolve).catch(() => resolve());
        };
        audio.play().catch((err) => {
          console.warn('[TTS] play() failed:', err);
          // iOS Safari may reject play() if not triggered by user gesture
          // Fallback to browser TTS
          playWithBrowserTTS(text).then(resolve).catch(() => resolve());
        });
      });
    } catch (err) {
      console.warn('[TTS] Server TTS failed, falling back:', err);
      return playWithBrowserTTS(text);
    }
  }

  // Native fallback
  return playWithBrowserTTS(text);
}

async function playWithBrowserTTS(text: string): Promise<void> {
  const isSpeaking = await Speech.isSpeakingAsync();
  if (isSpeaking) await Speech.stop();

  return new Promise<void>((resolve, reject) => {
    Speech.speak(text, {
      language: 'es-MX',
      rate: 0.9,
      pitch: 1.0,
      onDone: () => resolve(),
      onError: (error) => reject(error),
    });
  });
}

export async function stopAudio(): Promise<void> {
  if (currentAudioElement) {
    try {
      currentAudioElement.pause();
      currentAudioElement.currentTime = 0;
    } catch {}
    if (currentAudioUrl) {
      URL.revokeObjectURL(currentAudioUrl);
    }
    currentAudioElement = null;
    currentAudioUrl = null;
  }

  try {
    const isSpeaking = await Speech.isSpeakingAsync();
    if (isSpeaking) await Speech.stop();
  } catch {}
}
