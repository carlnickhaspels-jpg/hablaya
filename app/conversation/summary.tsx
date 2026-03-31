import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import Svg, { Circle } from 'react-native-svg';

import { colors, typography, spacing, borderRadius, shadows } from '@/src/constants/theme';
import { Message, Correction } from '@/src/types';
import { generateSessionSummary } from '@/src/services/ai';
import CorrectionCard from '@/src/components/CorrectionCard';

function ScoreRing({
  score,
  size = 96,
  strokeWidth = 8,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const remaining = circumference - progress;

  const scoreColor =
    score >= 80 ? colors.successGreen : score >= 65 ? colors.softOrange : colors.errorRed;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.lightGray}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={scoreColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${progress} ${remaining}`}
          strokeDashoffset={circumference * 0.25}
          strokeLinecap="round"
        />
      </Svg>
      <View style={StyleSheet.absoluteFill as any}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text
            style={{
              fontSize: typography.sizes.xl,
              fontWeight: typography.weights.bold,
              color: scoreColor,
            }}
          >
            {score}%
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function SummaryScreen() {
  const params = useLocalSearchParams<{
    messagesJson?: string;
    correctionsJson?: string;
    duration?: string;
    scenarioId?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [showTranscript, setShowTranscript] = useState(false);

  const messages: Message[] = useMemo(() => {
    try {
      return params.messagesJson ? JSON.parse(params.messagesJson) : [];
    } catch {
      return [];
    }
  }, [params.messagesJson]);

  const corrections: Correction[] = useMemo(() => {
    try {
      return params.correctionsJson ? JSON.parse(params.correctionsJson) : [];
    } catch {
      return [];
    }
  }, [params.correctionsJson]);

  const durationSeconds = parseInt(params.duration ?? '0', 10);

  const summary = useMemo(
    () => generateSessionSummary(messages, corrections, durationSeconds),
    [messages, corrections, durationSeconds]
  );

  const formatDuration = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  const handlePracticeAgain = () => {
    const scenarioId = params.scenarioId ?? 'free-talk';
    router.replace({
      pathname: '/conversation/[id]',
      params: { id: scenarioId },
    });
  };

  const handleGoHome = () => {
    router.replace('/(tabs)');
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.checkmarkCircle}>
            <Ionicons name="checkmark" size={36} color={colors.white} />
          </View>
          <Text style={styles.headerTitle}>Session Complete!</Text>
          <Text style={styles.headerSubtitle}>
            Great job practicing your Spanish today.
          </Text>
        </View>

        {/* Stats Cards Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="time-outline" size={24} color={colors.deepTeal} />
            <Text style={styles.statValue}>{formatDuration(summary.duration)}</Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="chatbubble-outline" size={24} color={colors.softOrange} />
            <Text style={styles.statValue}>{summary.wordsSpoken}</Text>
            <Text style={styles.statLabel}>Words Spoken</Text>
          </View>

          <View style={styles.statCardScore}>
            <ScoreRing score={summary.pronunciationScore} size={80} strokeWidth={6} />
            <Text style={styles.statLabel}>Pronunciation</Text>
          </View>
        </View>

        {/* Corrections Section */}
        {corrections.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="school-outline" size={20} color={colors.deepTeal} />
              <Text style={styles.sectionTitle}>
                Corrections ({corrections.length})
              </Text>
            </View>
            {corrections.map((correction) => (
              <CorrectionCard key={correction.id} correction={correction} />
            ))}
          </View>
        )}

        {/* What You Did Well */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="star-outline" size={20} color={colors.softOrange} />
            <Text style={styles.sectionTitle}>What You Did Well</Text>
          </View>
          <View style={styles.highlightCard}>
            {summary.highlights.map((highlight, i) => (
              <View key={i} style={styles.highlightRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={colors.successGreen}
                />
                <Text style={styles.highlightText}>{highlight}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Focus Areas */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="bulb-outline" size={20} color={colors.coral} />
            <Text style={styles.sectionTitle}>Focus Areas</Text>
          </View>
          <View style={styles.highlightCard}>
            {summary.focusAreas.map((area, i) => (
              <View key={i} style={styles.highlightRow}>
                <Ionicons
                  name="arrow-forward-circle"
                  size={18}
                  color={colors.softOrange}
                />
                <Text style={styles.highlightText}>{area}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Transcript Section */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.transcriptHeader}
            onPress={() => setShowTranscript(!showTranscript)}
            activeOpacity={0.7}
          >
            <View style={styles.sectionHeader}>
              <Ionicons
                name="document-text-outline"
                size={20}
                color={colors.textSecondary}
              />
              <Text style={styles.sectionTitle}>Conversation Transcript</Text>
            </View>
            <Ionicons
              name={showTranscript ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          {showTranscript && (
            <View style={styles.transcriptContainer}>
              {messages.map((msg) => (
                <View key={msg.id} style={styles.transcriptMessage}>
                  <Text
                    style={[
                      styles.transcriptRole,
                      msg.role === 'tutor'
                        ? styles.transcriptRoleTutor
                        : styles.transcriptRoleUser,
                    ]}
                  >
                    {msg.role === 'tutor' ? 'Tutor' : 'You'}
                  </Text>
                  <Text style={styles.transcriptContent}>{msg.content}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom Buttons */}
      <View
        style={[
          styles.bottomButtons,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
        <TouchableOpacity
          style={styles.outlineButton}
          onPress={handlePracticeAgain}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh" size={20} color={colors.deepTeal} />
          <Text style={styles.outlineButtonText}>Practice Again</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.filledButton}
          onPress={handleGoHome}
          activeOpacity={0.7}
        >
          <Ionicons name="home" size={20} color={colors.white} />
          <Text style={styles.filledButtonText}>Back to Home</Text>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
  },

  // ── Header ──────────────────────────────────────────────
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  checkmarkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.successGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadows.card,
  },
  headerTitle: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.darkText,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
  },

  // ── Stats ───────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
    ...shadows.subtle,
  },
  statCardScore: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    alignItems: 'center',
    gap: spacing.xs,
    ...shadows.subtle,
  },
  statValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.darkText,
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },

  // ── Sections ────────────────────────────────────────────
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.darkText,
  },

  // ── Highlights / Focus ──────────────────────────────────
  highlightCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.subtle,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  highlightText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.darkText,
    lineHeight: typography.sizes.sm * typography.lineHeights.normal,
  },

  // ── Transcript ──────────────────────────────────────────
  transcriptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...shadows.subtle,
  },
  transcriptContainer: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    gap: spacing.md,
    ...shadows.subtle,
  },
  transcriptMessage: {
    gap: 2,
  },
  transcriptRole: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  transcriptRoleTutor: {
    color: colors.deepTeal,
  },
  transcriptRoleUser: {
    color: colors.softOrange,
  },
  transcriptContent: {
    fontSize: typography.sizes.sm,
    color: colors.darkText,
    lineHeight: typography.sizes.sm * typography.lineHeights.relaxed,
  },

  // ── Bottom Buttons ──────────────────────────────────────
  bottomButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderGray,
  },
  outlineButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.deepTeal,
  },
  outlineButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.deepTeal,
  },
  filledButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.deepTeal,
    ...shadows.card,
  },
  filledButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.white,
  },
});
