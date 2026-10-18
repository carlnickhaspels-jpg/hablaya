import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, typography, spacing, borderRadius } from '@/src/constants/theme';
import { useApp } from '@/src/contexts/AppContext';
import { getInitialGreeting } from '@/src/services/ai';
import { unlockAudio } from '@/src/services/speech';
import {
  startVoiceSession,
  type VoiceSession,
  type VoiceState,
  type VoiceTranscript,
} from '@/src/services/livekitVoice';

const STATE_LABELS: Record<VoiceState, string> = {
  connecting: 'Verbinden...',
  listening: 'Ik luister',
  thinking: 'Denkt na',
  speaking: 'Spreekt',
  idle: 'Gestopt',
  error: 'Gestopt',
};

// Test page for the LiveKit voice room (route /voice-test). Not linked anywhere.
export default function VoiceTestScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const level = user?.level ?? 'principiante';

  const sessionRef = useRef<VoiceSession | null>(null);
  const [running, setRunning] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcripts, setTranscripts] = useState<VoiceTranscript[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [needsAudioTap, setNeedsAudioTap] = useState(false);

  // Stop the session when leaving the page
  useEffect(() => {
    return () => {
      sessionRef.current?.stop().catch(() => {});
      sessionRef.current = null;
    };
  }, []);

  const handleStart = useCallback(() => {
    setErrorMessage(null);
    setTranscripts([]);
    setNeedsAudioTap(false);
    setRunning(true);
    setVoiceState('connecting');

    sessionRef.current = startVoiceSession({
      level,
      greeting: getInitialGreeting(undefined, level),
      onState: (state) => {
        setVoiceState(state);
        if (state === 'error') setRunning(false);
      },
      onTranscript: (transcript) => {
        setTranscripts((prev) => {
          const index = prev.findIndex(
            (t) => t.id === transcript.id && t.role === transcript.role
          );
          if (index === -1) return [...prev, transcript];
          const next = [...prev];
          next[index] = transcript;
          return next;
        });
      },
      onError: (message) => setErrorMessage(message),
      onNeedsAudioTap: setNeedsAudioTap,
    });
  }, [level]);

  const handleStop = useCallback(async () => {
    const session = sessionRef.current;
    sessionRef.current = null;
    setRunning(false);
    await session?.stop();
    setVoiceState('idle');
  }, []);

  // Tap handler: unlockAudio() and startVoiceSession() must both run
  // synchronously in the tap (before any await) so iOS allows audio.
  const handleTogglePress = useCallback(() => {
    unlockAudio();
    if (running) {
      void handleStop();
    } else {
      handleStart();
    }
  }, [running, handleStart, handleStop]);

  const handleEnableAudio = useCallback(() => {
    unlockAudio();
    void sessionRef.current?.enableAudio();
  }, []);

  if (!user) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.infoText}>Je bent niet ingelogd. Log eerst in om de spraaktest te gebruiken.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Spraaktest</Text>
        <Text style={styles.stateText}>{STATE_LABELS[voiceState]}</Text>
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={styles.messagesContent}>
        {transcripts.map((t) => {
          const isTutor = t.role === 'tutor';
          return (
            <View
              key={`${t.role}-${t.id}`}
              style={isTutor ? styles.tutorWrapper : styles.userWrapper}
            >
              <View
                style={[
                  styles.bubble,
                  isTutor ? styles.tutorBubble : styles.userBubble,
                  !t.final && styles.bubbleInterim,
                ]}
              >
                <Text style={styles.speakerLabel}>{isTutor ? 'Tutor' : 'Jij'}</Text>
                <Text style={isTutor ? styles.tutorText : styles.userText}>{t.text}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {errorMessage && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      <View style={[styles.bottomArea, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {needsAudioTap && (
          <TouchableOpacity style={styles.audioButton} onPress={handleEnableAudio}>
            <Text style={styles.audioButtonText}>Tik om geluid aan te zetten</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.mainButton, running && styles.mainButtonStop]}
          onPress={handleTogglePress}
          activeOpacity={0.85}
        >
          <Text style={styles.mainButtonText}>{running ? 'Stop' : 'Start'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.warmWhite,
  },
  flex: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  infoText: {
    fontSize: typography.sizes.base,
    color: colors.darkText,
    textAlign: 'center',
  },
  header: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderGray,
    gap: 2,
  },
  title: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.darkText,
  },
  stateText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  messagesContent: {
    paddingVertical: spacing.md,
  },
  tutorWrapper: {
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  userWrapper: {
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
    borderRadius: borderRadius.lg,
  },
  tutorBubble: {
    backgroundColor: colors.deepTeal,
    borderTopLeftRadius: borderRadius.sm / 2,
  },
  userBubble: {
    backgroundColor: colors.white,
    borderTopRightRadius: borderRadius.sm / 2,
    borderWidth: 1,
    borderColor: colors.borderGray,
  },
  bubbleInterim: {
    opacity: 0.7,
  },
  speakerLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  tutorText: {
    fontSize: typography.sizes.base,
    color: colors.white,
  },
  userText: {
    fontSize: typography.sizes.base,
    color: colors.darkText,
  },
  errorBanner: {
    backgroundColor: colors.coral + '15',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.coral + '40',
  },
  errorText: {
    fontSize: typography.sizes.sm,
    color: colors.coral,
    fontWeight: typography.weights.medium,
  },
  bottomArea: {
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderGray,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  audioButton: {
    backgroundColor: colors.softOrange,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.full,
    alignItems: 'center',
  },
  audioButtonText: {
    color: colors.white,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  mainButton: {
    backgroundColor: colors.deepTeal,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
  },
  mainButtonStop: {
    backgroundColor: colors.coral,
  },
  mainButtonText: {
    color: colors.white,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
  },
});
