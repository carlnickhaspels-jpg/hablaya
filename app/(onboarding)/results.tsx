import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '@/src/constants/theme';
import { useApp } from '@/src/contexts/AppContext';
import type { FluencyLevel } from '@/src/types';

type LevelInfo = {
  fluencyLevel: FluencyLevel;
  displayName: string;
  emoji: string;
  description: string;
  focusAreas: string[];
  progressPercent: number;
};

const LEVEL_MAP: Record<string, LevelInfo> = {
  beginner: {
    fluencyLevel: 'silencioso',
    displayName: 'Silencioso',
    emoji: '🌱',
    description:
      'You\'re at the very beginning of your Spanish journey. We\'ll start with the essentials - greetings, basic phrases, and building your confidence to speak.',
    focusAreas: [
      'Basic greetings and introductions',
      'Essential vocabulary for daily life',
      'Simple sentence structures',
    ],
    progressPercent: 5,
  },
  basics: {
    fluencyLevel: 'principiante',
    displayName: 'Principiante',
    emoji: '💡',
    description:
      'You know some basics! Now it\'s time to start putting words together and having your first real conversations.',
    focusAreas: [
      'Expanding vocabulary with common phrases',
      'Present tense conversations',
      'Pronunciation and natural flow',
    ],
    progressPercent: 20,
  },
  intermediate: {
    fluencyLevel: 'conversador',
    displayName: 'Conversador',
    emoji: '💬',
    description:
      'You can hold conversations! Let\'s work on making your Spanish more natural and tackling more complex topics.',
    focusAreas: [
      'Past and future tenses in context',
      'Expressing opinions and emotions',
      'Reducing hesitation and filler words',
    ],
    progressPercent: 50,
  },
  advanced: {
    fluencyLevel: 'fluido',
    displayName: 'Fluido',
    emoji: '🚀',
    description:
      'You\'re already conversational! Let\'s refine your accent, expand your vocabulary, and help you sound like a native.',
    focusAreas: [
      'Subjunctive and complex grammar',
      'Idiomatic expressions and slang',
      'Accent refinement and natural rhythm',
    ],
    progressPercent: 75,
  },
};

export default function ResultsScreen() {
  const router = useRouter();
  const { level } = useLocalSearchParams<{ level: string }>();
  const { user, updateUser, setIsOnboarded } = useApp();

  const levelInfo = LEVEL_MAP[level ?? 'beginner'] ?? LEVEL_MAP.beginner;

  // Animations
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(40)).current;
  const progressWidth = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.9)).current;
  const celebrateScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Staggered entrance animation
    Animated.sequence([
      // Celebrate emoji pops in
      Animated.spring(celebrateScale, {
        toValue: 1,
        friction: 4,
        tension: 100,
        useNativeDriver: true,
      }),
      // Card fades and slides in
      Animated.parallel([
        Animated.timing(fadeIn, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(slideUp, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
        Animated.spring(cardScale, {
          toValue: 1,
          friction: 6,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Progress bar animation (separate, non-native driver)
    Animated.timing(progressWidth, {
      toValue: levelInfo.progressPercent,
      duration: 1200,
      delay: 800,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, []);

  async function handleStart() {
    // Update user with assigned level
    if (user) {
      await updateUser({
        level: levelInfo.fluencyLevel,
        subLevel: 1,
      });
    }
    setIsOnboarded(true);
    router.replace('/(tabs)');
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Progress indicator */}
          <View style={styles.progressRow}>
            <View style={styles.progressDotDone} />
            <View style={styles.progressDotDone} />
            <View style={styles.progressDotActive} />
          </View>

          {/* Celebration header */}
          <View style={styles.celebrationSection}>
            <Animated.Text
              style={[
                styles.emoji,
                { transform: [{ scale: celebrateScale }] },
              ]}
            >
              {levelInfo.emoji}
            </Animated.Text>
            <Text style={styles.resultTitle}>
              You're a {levelInfo.displayName}!
            </Text>
            <Text style={styles.encouragement}>
              You're ready to start speaking!
            </Text>
          </View>

          {/* Level card */}
          <Animated.View
            style={[
              styles.levelCard,
              {
                opacity: fadeIn,
                transform: [
                  { translateY: slideUp },
                  { scale: cardScale },
                ],
              },
            ]}
          >
            <View style={styles.levelCardHeader}>
              <View style={styles.levelBadge}>
                <Text style={styles.levelBadgeText}>
                  {levelInfo.displayName}
                </Text>
              </View>
              <Text style={styles.levelCardSubtitle}>Fluency Level</Text>
            </View>

            {/* Progress bar */}
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBarTrack}>
                <Animated.View
                  style={[
                    styles.progressBarFill,
                    {
                      width: progressWidth.interpolate({
                        inputRange: [0, 100],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
              <View style={styles.progressLabels}>
                <Text style={styles.progressLabelStart}>Silencioso</Text>
                <Text style={styles.progressLabelEnd}>Nativo</Text>
              </View>
            </View>

            {/* Description */}
            <Text style={styles.levelDescription}>
              {levelInfo.description}
            </Text>
          </Animated.View>

          {/* Focus areas */}
          <Animated.View
            style={[
              styles.focusSection,
              {
                opacity: fadeIn,
                transform: [{ translateY: slideUp }],
              },
            ]}
          >
            <Text style={styles.focusTitle}>What you'll focus on</Text>
            {levelInfo.focusAreas.map((area, index) => (
              <View key={index} style={styles.focusItem}>
                <View style={styles.focusIcon}>
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={colors.successGreen}
                  />
                </View>
                <Text style={styles.focusText}>{area}</Text>
              </View>
            ))}
          </Animated.View>
        </ScrollView>

        {/* Bottom CTA */}
        <View style={styles.bottomSection}>
          <Pressable
            style={({ pressed }) => [
              styles.startButton,
              pressed && styles.startButtonPressed,
            ]}
            onPress={handleStart}
          >
            <Ionicons name="chatbubble-ellipses" size={22} color={colors.white} />
            <Text style={styles.startButtonText}>
              Start Your First Conversation
            </Text>
          </Pressable>
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
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
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
  celebrationSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  emoji: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  resultTitle: {
    fontSize: typography.sizes.xxxl,
    fontWeight: typography.weights.bold,
    color: colors.darkText,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  encouragement: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.medium,
    color: colors.deepTeal,
    textAlign: 'center',
  },
  levelCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderGray,
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  levelCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  levelBadge: {
    backgroundColor: colors.deepTeal,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  levelBadgeText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.white,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  levelCardSubtitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  progressBarContainer: {
    marginBottom: spacing.lg,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: colors.lightGray,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.deepTeal,
    borderRadius: 4,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabelStart: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  progressLabelEnd: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  levelDescription: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.regular,
    color: colors.darkText,
    lineHeight: typography.sizes.base * typography.lineHeights.relaxed,
  },
  focusSection: {
    marginBottom: spacing.lg,
  },
  focusTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.darkText,
    marginBottom: spacing.md,
  },
  focusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    paddingVertical: spacing.xs,
  },
  focusIcon: {
    width: 24,
    alignItems: 'center',
  },
  focusText: {
    flex: 1,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.regular,
    color: colors.darkText,
    lineHeight: typography.sizes.base * typography.lineHeights.normal,
  },
  bottomSection: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  startButton: {
    backgroundColor: colors.softOrange,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    ...shadows.card,
  },
  startButtonPressed: {
    backgroundColor: colors.coral,
    transform: [{ scale: 0.98 }],
  },
  startButtonText: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
});
