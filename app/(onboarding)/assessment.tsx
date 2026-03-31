import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '@/src/constants/theme';

const { width } = Dimensions.get('window');

const PHRASES: Record<string, { phrase: string; translation: string; hint: string }> = {
  beginner: {
    phrase: 'Hola, me llamo...',
    translation: '"Hello, my name is..."',
    hint: 'Just say "Hola" and your name!',
  },
  basics: {
    phrase: 'Me gusta mucho viajar.',
    translation: '"I really like to travel."',
    hint: 'Try saying the full sentence.',
  },
  intermediate: {
    phrase: 'Ayer fui al mercado y compre frutas frescas.',
    translation: '"Yesterday I went to the market and bought fresh fruits."',
    hint: 'Speak naturally, like you\'re telling a friend.',
  },
  advanced: {
    phrase: 'Si pudiera vivir en cualquier pais, elegiria uno con playa.',
    translation: '"If I could live in any country, I would choose one with a beach."',
    hint: 'Focus on your pronunciation and flow.',
  },
};

type Phase = 'ready' | 'recording' | 'listening' | 'analyzing';

export default function AssessmentScreen() {
  const router = useRouter();
  const { level } = useLocalSearchParams<{ level: string }>();

  const phraseData = PHRASES[level ?? 'beginner'] ?? PHRASES.beginner;

  const [phase, setPhase] = useState<Phase>('ready');
  const [recordingTime, setRecordingTime] = useState(0);

  // Pulse animation for mic button
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0)).current;

  // Waveform bar animations (5 bars)
  const waveAnims = useRef(
    Array.from({ length: 5 }, () => new Animated.Value(0.3))
  ).current;

  // Fade for analyzing state
  const analyzeAnim = useRef(new Animated.Value(0)).current;
  const dotsAnim = useRef(new Animated.Value(0)).current;

  // Pulse animation loop
  useEffect(() => {
    if (phase === 'recording' || phase === 'listening') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 1.25,
              duration: 800,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(pulseOpacity, {
              toValue: 0.4,
              duration: 800,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 800,
              easing: Easing.in(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(pulseOpacity, {
              toValue: 0,
              duration: 800,
              easing: Easing.in(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
      pulseOpacity.setValue(0);
    }
  }, [phase]);

  // Waveform animation
  useEffect(() => {
    if (phase === 'recording' || phase === 'listening') {
      const animations = waveAnims.map((anim, i) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 0.6 + Math.random() * 0.4,
              duration: 200 + i * 80,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0.2 + Math.random() * 0.2,
              duration: 250 + i * 60,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        )
      );
      animations.forEach((a) => a.start());
      return () => animations.forEach((a) => a.stop());
    } else {
      waveAnims.forEach((a) => a.setValue(0.3));
    }
  }, [phase]);

  // Recording timer
  useEffect(() => {
    if (phase === 'recording') {
      const interval = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 4) {
            clearInterval(interval);
            setPhase('listening');
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [phase]);

  // Listening -> Analyzing transition
  useEffect(() => {
    if (phase === 'listening') {
      const timer = setTimeout(() => {
        setPhase('analyzing');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  // Analyzing animation and navigation
  useEffect(() => {
    if (phase === 'analyzing') {
      Animated.timing(analyzeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();

      const loopDots = Animated.loop(
        Animated.sequence([
          Animated.timing(dotsAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(dotsAnim, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      loopDots.start();

      const timer = setTimeout(() => {
        router.replace({
          pathname: '/(onboarding)/results',
          params: { level: level ?? 'beginner' },
        });
      }, 2500);

      return () => {
        clearTimeout(timer);
        loopDots.stop();
      };
    }
  }, [phase]);

  function handleMicPress() {
    if (phase === 'ready') {
      setRecordingTime(0);
      setPhase('recording');
    }
  }

  function formatTime(seconds: number): string {
    return `0:${seconds.toString().padStart(2, '0')}`;
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Progress indicator */}
        <View style={styles.progressRow}>
          <View style={styles.progressDotDone} />
          <View style={styles.progressDotActive} />
          <View style={styles.progressDot} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Let's hear you speak!</Text>
          <Text style={styles.subtitle}>
            {phase === 'ready'
              ? 'Tap the microphone and repeat the phrase below'
              : phase === 'recording'
              ? 'Listening to you...'
              : phase === 'listening'
              ? 'Processing your speech...'
              : 'Analyzing your pronunciation...'}
          </Text>
        </View>

        {/* Phrase card */}
        {phase !== 'analyzing' && (
          <View style={styles.phraseCard}>
            <View style={styles.phraseHeader}>
              <Ionicons
                name="volume-high-outline"
                size={20}
                color={colors.deepTeal}
              />
              <Text style={styles.phraseLabel}>Say this phrase:</Text>
            </View>
            <Text style={styles.phraseText}>{phraseData.phrase}</Text>
            <Text style={styles.phraseTranslation}>
              {phraseData.translation}
            </Text>
            {phase === 'ready' && (
              <Text style={styles.phraseHint}>{phraseData.hint}</Text>
            )}
          </View>
        )}

        {/* Mic section */}
        <View style={styles.micSection}>
          {phase === 'analyzing' ? (
            <Animated.View
              style={[styles.analyzingContainer, { opacity: analyzeAnim }]}
            >
              <View style={styles.analyzingIcon}>
                <Ionicons name="sparkles" size={36} color={colors.softOrange} />
              </View>
              <Text style={styles.analyzingText}>Analyzing...</Text>
              <Animated.View
                style={[
                  styles.analyzingDots,
                  {
                    opacity: dotsAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.4, 1],
                    }),
                  },
                ]}
              >
                <View style={[styles.dot, { backgroundColor: colors.deepTeal }]} />
                <View style={[styles.dot, { backgroundColor: colors.deepTeal, opacity: 0.7 }]} />
                <View style={[styles.dot, { backgroundColor: colors.deepTeal, opacity: 0.4 }]} />
              </Animated.View>
            </Animated.View>
          ) : (
            <>
              {/* Waveform bars */}
              {(phase === 'recording' || phase === 'listening') && (
                <View style={styles.waveformContainer}>
                  {waveAnims.map((anim, i) => (
                    <Animated.View
                      key={i}
                      style={[
                        styles.waveBar,
                        {
                          transform: [{ scaleY: anim }],
                          backgroundColor:
                            i % 2 === 0 ? colors.deepTeal : colors.softOrange,
                        },
                      ]}
                    />
                  ))}
                </View>
              )}

              {/* Timer */}
              {phase === 'recording' && (
                <Text style={styles.timerText}>{formatTime(recordingTime)}</Text>
              )}

              {/* Mic button with pulse ring */}
              <View style={styles.micButtonWrapper}>
                <Animated.View
                  style={[
                    styles.pulseRing,
                    {
                      transform: [{ scale: pulseAnim }],
                      opacity: pulseOpacity,
                    },
                  ]}
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.micButton,
                    (phase === 'recording' || phase === 'listening') &&
                      styles.micButtonRecording,
                    pressed && phase === 'ready' && styles.micButtonPressed,
                  ]}
                  onPress={handleMicPress}
                  disabled={phase !== 'ready'}
                >
                  <Ionicons
                    name={
                      phase === 'ready'
                        ? 'mic'
                        : phase === 'recording'
                        ? 'mic'
                        : 'radio-outline'
                    }
                    size={40}
                    color={colors.white}
                  />
                </Pressable>
              </View>

              {/* Instruction text */}
              {phase === 'ready' && (
                <Text style={styles.instructionText}>Tap to start speaking</Text>
              )}
              {phase === 'listening' && (
                <Text style={styles.instructionText}>Processing...</Text>
              )}
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.warmWhite,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  progressDotDone: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.successGreen,
  },
  progressDotActive: {
    width: 28,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.deepTeal,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.borderGray,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.darkText,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.regular,
    color: colors.textSecondary,
    lineHeight: typography.sizes.base * typography.lineHeights.relaxed,
  },
  phraseCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderGray,
    ...shadows.card,
  },
  phraseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  phraseLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.deepTeal,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  phraseText: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.darkText,
    marginBottom: spacing.sm,
    lineHeight: typography.sizes.xl * typography.lineHeights.normal,
  },
  phraseTranslation: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  phraseHint: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.softOrange,
    marginTop: spacing.sm,
  },
  micSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.xxl,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 60,
    marginBottom: spacing.lg,
  },
  waveBar: {
    width: 6,
    height: 48,
    borderRadius: 3,
  },
  timerText: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.coral,
    marginBottom: spacing.md,
  },
  micButtonWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 120,
    height: 120,
  },
  pulseRing: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.coral,
  },
  micButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.deepTeal,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.elevated,
  },
  micButtonRecording: {
    backgroundColor: colors.coral,
  },
  micButtonPressed: {
    backgroundColor: colors.deepTealDark,
    transform: [{ scale: 0.95 }],
  },
  instructionText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
    marginTop: spacing.lg,
  },
  analyzingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  analyzingIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF5ED',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  analyzingText: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.darkText,
  },
  analyzingDots: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
