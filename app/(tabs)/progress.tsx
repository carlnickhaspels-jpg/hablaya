import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '@/src/constants/theme';
import { useApp } from '@/src/contexts/AppContext';

const LEVEL_NAMES: Record<string, string> = {
  silencioso: 'Silencioso',
  principiante: 'Principiante',
  conversador: 'Conversador',
  fluido: 'Fluido',
  nativo: 'Nativo',
};

const LEVEL_DESCRIPTIONS: Record<string, string> = {
  silencioso: 'Just getting started',
  principiante: 'Building foundations',
  conversador: 'Having real conversations',
  fluido: 'Speaking with confidence',
  nativo: 'Near-native fluency',
};

const MOCK_WEEKLY_MINUTES = [
  { day: 'Mon', minutes: 12 },
  { day: 'Tue', minutes: 18 },
  { day: 'Wed', minutes: 8 },
  { day: 'Thu', minutes: 22 },
  { day: 'Fri', minutes: 15 },
  { day: 'Sat', minutes: 25 },
  { day: 'Sun', minutes: 5 },
];

const MOCK_ERROR_TRENDS = [
  { type: 'Grammar', count: 14, trend: 'down' as const, icon: 'document-text-outline' as const },
  { type: 'Vocabulary', count: 8, trend: 'down' as const, icon: 'book-outline' as const },
  { type: 'Pronunciation', count: 11, trend: 'up' as const, icon: 'mic-outline' as const },
];

const MOCK_RECENT_SESSIONS = [
  {
    id: '1',
    scenario: 'Pidiendo un caf\u00e9',
    date: 'Today, 2:30 PM',
    duration: 4,
    score: 82,
  },
  {
    id: '2',
    scenario: 'Conociendo a alguien nuevo',
    date: 'Yesterday, 6:15 PM',
    duration: 6,
    score: 75,
  },
  {
    id: '3',
    scenario: 'Conversaci\u00f3n libre',
    date: 'Mar 28, 10:00 AM',
    duration: 8,
    score: 70,
  },
  {
    id: '4',
    scenario: 'Comprando en el supermercado',
    date: 'Mar 27, 3:45 PM',
    duration: 5,
    score: 78,
  },
  {
    id: '5',
    scenario: 'Hablando de pasatiempos',
    date: 'Mar 26, 7:00 PM',
    duration: 5,
    score: 73,
  },
];

export default function ProgressScreen() {
  const { user, userProgress } = useApp();

  const level = userProgress?.level ?? user?.level ?? 'principiante';
  const subLevel = 2;
  const progressToNext = 0.45;
  const minutesToday = userProgress?.minutesSpokenToday ?? 12;
  const conversationsCompleted = userProgress?.scenariosCompleted ?? user?.conversationsCompleted ?? 7;
  const currentStreak = userProgress?.currentStreak ?? user?.streak ?? 3;
  const wordsUsed = userProgress?.wordsUsed ?? 342;

  const maxMinutes = Math.max(...MOCK_WEEKLY_MINUTES.map((d) => d.minutes));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Your Progress</Text>
          <Text style={styles.headerSubtitle}>Keep up the great work!</Text>
        </View>

        {/* Fluency Level Card */}
        <View style={styles.levelCard}>
          <View style={styles.levelCardTop}>
            <View style={styles.levelBadge}>
              <Ionicons name="ribbon" size={20} color={colors.deepTeal} />
            </View>
            <View style={styles.levelInfo}>
              <Text style={styles.levelName}>{LEVEL_NAMES[level]}</Text>
              <Text style={styles.levelDescription}>{LEVEL_DESCRIPTIONS[level]}</Text>
            </View>
            <View style={styles.subLevelBadge}>
              <Text style={styles.subLevelText}>Level {subLevel}</Text>
            </View>
          </View>
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarBackground}>
              <View style={[styles.progressBarFill, { width: `${progressToNext * 100}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {Math.round(progressToNext * 100)}% to next level
            </Text>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.statIconBg, { backgroundColor: '#E8F5F3' }]}>
              <Ionicons name="time-outline" size={22} color={colors.deepTeal} />
            </View>
            <Text style={styles.statValue}>{minutesToday}</Text>
            <Text style={styles.statLabel}>Min spoken today</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconBg, { backgroundColor: '#FFF3E0' }]}>
              <Ionicons name="chatbubbles-outline" size={22} color={colors.softOrange} />
            </View>
            <Text style={styles.statValue}>{conversationsCompleted}</Text>
            <Text style={styles.statLabel}>Conversations</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconBg, { backgroundColor: '#FDE8E8' }]}>
              <Ionicons name="flame-outline" size={22} color={colors.coral} />
            </View>
            <Text style={styles.statValue}>{currentStreak}</Text>
            <Text style={styles.statLabel}>Day streak</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconBg, { backgroundColor: '#E8F0FE' }]}>
              <Ionicons name="text-outline" size={22} color="#3B82F6" />
            </View>
            <Text style={styles.statValue}>{wordsUsed}</Text>
            <Text style={styles.statLabel}>Words used</Text>
          </View>
        </View>

        {/* This Week - Bar Chart */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionCardTitle}>This Week</Text>
          <Text style={styles.sectionCardSubtitle}>Minutes spoken per day</Text>
          <View style={styles.chartContainer}>
            {MOCK_WEEKLY_MINUTES.map((item, index) => {
              const barHeight = maxMinutes > 0 ? (item.minutes / maxMinutes) * 120 : 0;
              const isToday = index === MOCK_WEEKLY_MINUTES.length - 1;
              return (
                <View key={item.day} style={styles.chartBarContainer}>
                  <Text style={styles.chartBarValue}>{item.minutes}</Text>
                  <View style={styles.chartBarWrapper}>
                    <View
                      style={[
                        styles.chartBar,
                        {
                          height: Math.max(barHeight, 4),
                          backgroundColor: isToday ? colors.softOrange : colors.deepTeal,
                          opacity: isToday ? 1 : 0.7 + (index * 0.05),
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.chartBarLabel,
                      isToday && { color: colors.deepTeal, fontWeight: typography.weights.bold },
                    ]}
                  >
                    {item.day}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Error Trends */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionCardTitle}>Error Trends</Text>
          <Text style={styles.sectionCardSubtitle}>Corrections this week</Text>
          {MOCK_ERROR_TRENDS.map((error) => (
            <View key={error.type} style={styles.errorRow}>
              <View style={styles.errorLeft}>
                <View style={styles.errorIconBg}>
                  <Ionicons name={error.icon} size={18} color={colors.deepTeal} />
                </View>
                <Text style={styles.errorType}>{error.type}</Text>
              </View>
              <View style={styles.errorRight}>
                <Text style={styles.errorCount}>{error.count} corrections</Text>
                <View
                  style={[
                    styles.trendBadge,
                    {
                      backgroundColor:
                        error.trend === 'down' ? '#E8F5E9' : '#FDE8E8',
                    },
                  ]}
                >
                  <Ionicons
                    name={error.trend === 'down' ? 'trending-down' : 'trending-up'}
                    size={14}
                    color={error.trend === 'down' ? colors.successGreen : colors.errorRed}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Recent Sessions */}
        <View style={[styles.sectionCard, { marginBottom: 120 }]}>
          <Text style={styles.sectionCardTitle}>Recent Sessions</Text>
          {MOCK_RECENT_SESSIONS.map((session) => (
            <View key={session.id} style={styles.sessionRow}>
              <View style={styles.sessionLeft}>
                <View style={styles.sessionDot} />
                <View style={styles.sessionInfo}>
                  <Text style={styles.sessionScenario}>{session.scenario}</Text>
                  <Text style={styles.sessionDate}>{session.date}</Text>
                </View>
              </View>
              <View style={styles.sessionRight}>
                <View style={styles.sessionMeta}>
                  <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
                  <Text style={styles.sessionDuration}>{session.duration}m</Text>
                </View>
                <View style={styles.sessionScoreContainer}>
                  <Text style={styles.sessionScore}>{session.score}%</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.warmWhite,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  header: {
    marginBottom: spacing.lg,
  },
  headerTitle: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.darkText,
  },
  headerSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  levelCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  levelCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  levelBadge: {
    backgroundColor: '#E8F5F3',
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  levelInfo: {
    flex: 1,
  },
  levelName: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.darkText,
  },
  levelDescription: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  subLevelBadge: {
    backgroundColor: colors.deepTeal,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  subLevelText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.white,
  },
  progressBarContainer: {
    gap: spacing.sm,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: colors.lightGray,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.deepTeal,
    borderRadius: borderRadius.full,
  },
  progressText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    width: '47%',
    flexGrow: 1,
    alignItems: 'center',
    ...shadows.subtle,
  },
  statIconBg: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.darkText,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  sectionCardTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.darkText,
    marginBottom: 2,
  },
  sectionCardSubtitle: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 160,
  },
  chartBarContainer: {
    alignItems: 'center',
    flex: 1,
  },
  chartBarValue: {
    fontSize: 10,
    color: colors.textSecondary,
    marginBottom: 4,
    fontWeight: typography.weights.medium,
  },
  chartBarWrapper: {
    height: 120,
    justifyContent: 'flex-end',
    width: '100%',
    alignItems: 'center',
  },
  chartBar: {
    width: 24,
    borderRadius: 6,
    minHeight: 4,
  },
  chartBarLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    fontWeight: typography.weights.medium,
  },
  errorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  errorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  errorIconBg: {
    backgroundColor: '#E8F5F3',
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorType: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.darkText,
  },
  errorRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  errorCount: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  trendBadge: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  sessionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sessionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.deepTeal,
    marginRight: spacing.md,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionScenario: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.darkText,
  },
  sessionDate: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sessionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  sessionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  sessionDuration: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  sessionScoreContainer: {
    backgroundColor: '#E8F5F3',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  sessionScore: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.deepTeal,
  },
});
