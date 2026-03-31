import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

/**
 * Speech service using the Web Speech API (SpeechRecognition) for speech-to-text
 * and expo-speech for text-to-speech.
 *
 * Web Speech API works in Chrome, Edge, Safari (including mobile).
 * For native iOS/Android, swap this for expo-av recording + Deepgram/Whisper API.
 */

// ── Web Speech API types ────────────────────────────────────────────────────
interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string; message?: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

// ── State ───────────────────────────────────────────────────────────────────
let recognition: SpeechRecognitionInstance | null = null;
let resolveRecording: ((text: string) => void) | null = null;
let accumulatedTranscript = '';
let isRecording = false;

function getSpeechRecognition(): SpeechRecognitionInstance | null {
  if (Platform.OS !== 'web') return null;

  const win = window as any;
  const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;

  return new SpeechRecognition() as SpeechRecognitionInstance;
}

// ── Recording (Speech-to-Text) ──────────────────────────────────────────────

export async function startRecording(): Promise<void> {
  if (Platform.OS !== 'web') {
    console.log('[Speech] Recording not supported on this platform yet');
    return;
  }

  const rec = getSpeechRecognition();
  if (!rec) {
    console.warn('[Speech] SpeechRecognition not available in this browser');
    return;
  }

  accumulatedTranscript = '';
  isRecording = true;

  rec.lang = 'es-ES';
  rec.interimResults = true;
  rec.continuous = true;
  rec.maxAlternatives = 1;

  rec.onresult = (event: SpeechRecognitionEvent) => {
    let finalTranscript = '';
    for (let i = 0; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        finalTranscript += result[0].transcript;
      }
    }
    if (finalTranscript) {
      accumulatedTranscript = finalTranscript;
    }
  };

  rec.onerror = (event) => {
    console.warn('[Speech] Recognition error:', event.error);
    if (event.error === 'not-allowed') {
      console.error('[Speech] Microphone permission denied');
    }
  };

  rec.onend = () => {
    isRecording = false;
    if (resolveRecording) {
      const text = accumulatedTranscript.trim();
      resolveRecording(text || '(no speech detected)');
      resolveRecording = null;
    }
  };

  recognition = rec;

  try {
    rec.start();
    console.log('[Speech] Recording started');
  } catch (err) {
    console.error('[Speech] Failed to start recording:', err);
    isRecording = false;
  }
}

export async function stopRecording(): Promise<string> {
  return new Promise<string>((resolve) => {
    if (!recognition || !isRecording) {
      resolve(accumulatedTranscript.trim() || '(no speech detected)');
      return;
    }

    resolveRecording = resolve;

    try {
      recognition.stop();
    } catch {
      resolve(accumulatedTranscript.trim() || '(no speech detected)');
      resolveRecording = null;
    }
  });
}

// ── Text-to-Speech ──────────────────────────────────────────────────────────

export async function playAudio(text: string): Promise<void> {
  const isSpeaking = await Speech.isSpeakingAsync();
  if (isSpeaking) {
    await Speech.stop();
  }

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
  const isSpeaking = await Speech.isSpeakingAsync();
  if (isSpeaking) {
    await Speech.stop();
  }
}

export async function getSpeechToTextResult(audioUri: string): Promise<string> {
  console.log('[Speech] Processing audio from:', audioUri);
  return '(not implemented for audio files)';
}
