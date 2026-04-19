import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

/**
 * Speech service: MediaRecorder API for recording + server-side Whisper for transcription.
 * Works on iPhone Safari, Android Chrome, and desktop browsers.
 */

let mediaRecorder: any = null;
let audioChunks: Blob[] = [];
let resolveRecording: ((text: string) => void) | null = null;
let rejectRecording: ((err: Error) => void) | null = null;
let isRecording = false;
let activeMimeType = '';

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

export async function startRecording(): Promise<void> {
  if (Platform.OS !== 'web') {
    console.log('[Speech] Recording not supported on native yet');
    return;
  }

  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone API not available in this browser.');
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    audioChunks = [];
    activeMimeType = pickMimeType();

    const options: any = activeMimeType ? { mimeType: activeMimeType } : {};
    mediaRecorder = new MediaRecorder(stream, options);

    mediaRecorder.ondataavailable = (event: any) => {
      if (event.data && event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      // Release microphone
      stream.getTracks().forEach((track: any) => track.stop());

      const totalSize = audioChunks.reduce((sum, c) => sum + c.size, 0);
      console.log(`[Speech] Recording stopped. Chunks: ${audioChunks.length}, total bytes: ${totalSize}, mime: ${activeMimeType}`);

      if (totalSize < 1000) {
        // Too little audio captured
        if (rejectRecording) {
          rejectRecording(new Error('No audio captured. Please try again.'));
          resolveRecording = null;
          rejectRecording = null;
        }
        return;
      }

      const audioBlob = new Blob(audioChunks, {
        type: activeMimeType || 'audio/webm',
      });

      try {
        const response = await fetch('/api/transcribe', {
          method: 'POST',
          body: audioBlob,
          headers: {
            'Content-Type': activeMimeType || 'audio/webm',
          },
        });

        const data = await response.json();
        console.log('[Speech] Transcription response:', data);

        if (!response.ok) {
          throw new Error(data.error || `HTTP ${response.status}`);
        }

        const text = (data.text || '').trim();

        if (resolveRecording) {
          if (text) {
            resolveRecording(text);
          } else if (rejectRecording) {
            rejectRecording(new Error('No speech detected. Try speaking louder.'));
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
        rejectRecording(new Error('Recording failed: ' + (event.error?.message || 'unknown')));
        resolveRecording = null;
        rejectRecording = null;
      }
    };

    // start with timeslice so we get periodic ondataavailable events
    mediaRecorder.start(250);
    isRecording = true;
    console.log(`[Speech] Recording started (mime: ${activeMimeType || 'default'})`);
  } catch (err: any) {
    console.error('[Speech] Failed to start recording:', err);
    isRecording = false;

    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      throw new Error('Microphone permission denied. Please allow microphone access in your browser settings.');
    }
    if (err.name === 'NotFoundError') {
      throw new Error('No microphone found on this device.');
    }
    throw new Error(err.message || 'Failed to start recording');
  }
}

export async function stopRecording(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    if (!mediaRecorder || !isRecording) {
      reject(new Error('No active recording'));
      return;
    }

    resolveRecording = resolve;
    rejectRecording = reject;
    isRecording = false;

    try {
      // Force MediaRecorder to flush any buffered audio before stopping.
      // This is crucial on iOS Safari to get the final audio chunk.
      if (typeof mediaRecorder.requestData === 'function') {
        try { mediaRecorder.requestData(); } catch {}
      }
      // Small delay to let requestData fire ondataavailable, then stop
      setTimeout(() => {
        try {
          mediaRecorder.stop();
        } catch (err: any) {
          if (rejectRecording) {
            rejectRecording(new Error('Failed to stop recording: ' + err.message));
            resolveRecording = null;
            rejectRecording = null;
          }
        }
      }, 100);
    } catch (err: any) {
      reject(new Error('Failed to stop recording: ' + err.message));
      resolveRecording = null;
      rejectRecording = null;
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
