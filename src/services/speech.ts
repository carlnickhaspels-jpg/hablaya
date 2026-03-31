import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

/**
 * Speech service using MediaRecorder API for recording + server-side Whisper
 * for transcription. Works on all mobile browsers (iPhone Safari, Chrome, etc.)
 */

let mediaRecorder: any = null;
let audioChunks: Blob[] = [];
let resolveRecording: ((text: string) => void) | null = null;
let isRecording = false;
let audioStream: any = null;

export async function startRecording(): Promise<void> {
  if (Platform.OS !== 'web') {
    console.log('[Speech] Recording not supported on native yet');
    return;
  }

  try {
    // Request microphone access
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 16000,
      },
    });

    audioStream = stream;
    audioChunks = [];

    // Use webm if supported, fall back to mp4 for Safari
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : MediaRecorder.isTypeSupported('audio/mp4')
      ? 'audio/mp4'
      : '';

    const options: any = {};
    if (mimeType) options.mimeType = mimeType;

    mediaRecorder = new MediaRecorder(stream, options);

    mediaRecorder.ondataavailable = (event: any) => {
      if (event.data && event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      // Stop all tracks to release the microphone
      stream.getTracks().forEach((track: any) => track.stop());
      audioStream = null;

      const audioBlob = new Blob(audioChunks, {
        type: mimeType || 'audio/webm',
      });

      // Send to our backend for Whisper transcription
      try {
        const response = await fetch('/api/transcribe', {
          method: 'POST',
          body: audioBlob,
          headers: {
            'Content-Type': 'application/octet-stream',
          },
        });

        const data = await response.json();
        const text = data.text?.trim() || '';

        if (resolveRecording) {
          resolveRecording(text || '(no speech detected)');
          resolveRecording = null;
        }
      } catch (err) {
        console.error('[Speech] Transcription error:', err);
        if (resolveRecording) {
          resolveRecording('(transcription failed)');
          resolveRecording = null;
        }
      }
    };

    mediaRecorder.onerror = (event: any) => {
      console.error('[Speech] MediaRecorder error:', event.error);
      if (resolveRecording) {
        resolveRecording('(recording error)');
        resolveRecording = null;
      }
    };

    // Collect data every second
    mediaRecorder.start(1000);
    isRecording = true;
    console.log('[Speech] Recording started');
  } catch (err: any) {
    console.error('[Speech] Failed to start recording:', err);
    isRecording = false;

    if (err.name === 'NotAllowedError') {
      throw new Error('Microphone permission denied. Please allow microphone access and try again.');
    }
    throw err;
  }
}

export async function stopRecording(): Promise<string> {
  return new Promise<string>((resolve) => {
    if (!mediaRecorder || !isRecording) {
      resolve('(no recording)');
      return;
    }

    resolveRecording = resolve;
    isRecording = false;

    try {
      mediaRecorder.stop();
    } catch {
      resolve('(failed to stop recording)');
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
