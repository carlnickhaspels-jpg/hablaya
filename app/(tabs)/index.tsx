import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, typography, spacing, borderRadius, shadows } from '@/src/constants/theme';
import { useApp } from '@/src/contexts/AppContext';
import { scenarios } from '@/src/constants/scenarios';

const MOCK_RECENT_SESSIONS = [
  {
    id: '1',
    scenarioTitle: 'Ordering Coffee',
    scenarioTitleEs: 'Pidiendo un caf\u00e9',
    date: '2 hours ago',
    duration: 4,
    score: 82,
  },
  {
    id: '2',
    scenarioTitle: 'Meeting Someone New',
    scenarioTitleEs: 'Conociendo a alguien nuevo',
    date: 'Yesterday',
    duration: 6,
    score: 75,
  },
  {
    id: '3',
    scenarioTitle: 'Free Talk',
    scenarioTitleEs: 'Conversaci\u00f3n libre',
    date: '2 days ago',
    duration: 8,
    score: 70,
  },
];

export default function HomeScreen() {
  const { user, userProgress } = useApp();
  const router = useRouter();
  const [refreshing, setRefreshing] = React.useState(false);

  const suggestedScenario = useMemo(() => {
    const index = Math.floor(Math.random() * scenarios.length);
    return scenarios[index];
  }, []);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const today = new Date();
  const dateString = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const userName = user?.name?.split(' ')[0] || 'Student';
  const streak = userProgress?.currentStreak ?? user?.streak ?? 3;

  const getStreakMessage = (s: number) => {
    if (s >= 30) return 'Incredible dedication!';
    if (s >= 14) return 'Two weeks strong!';
    if (s >= 7) return "You're on fire!";
    if (s >= 3) return 'Keep it going!';
    return "Let's build your streak!";
  };

  const getDifficultyDots = (level: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <View
        key={i}
        style={[
          styles.difficultyDot,
          { backgroundColor: i < level ? colors.deepTeal : colors.borderGray },
        ]}
      />
    ));
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.deepTeal}
          />
        }
      >
        {/* Greeting Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>\u00a1Hola, {userName}!</Text>
            <Text style={styles.date}>{dateString}</Text>
          </View>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <Ionicons name="person-circle-outline" size={40} color={colors.deepTeal} />
          </TouchableOpacity>
        </View>

        {/* Streak Card */}
        <TouchableOpacity style={styles.streakCard} activeOpacity={0.9}>
          <View style={styles.streakLeft}>
            <Text style={styles.streakEmoji}>{'\ud83d\udd25'}</Text>
            <View>
              <Text style={styles.streakCount}>{streak} day streak</Text>
              <Text style={styles.streakMessage}>{getStreakMessage(streak)}</Text>
            </View>
          </View>
          <View style={styles.streakBadge}>
            <Ionicons name="trophy-outline" size={20} color={colors.white} />
          </View>
        </TouchableOpacity>

        {/* Continue Speaking */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Continue Speaking</Text>
          <TouchableOpacity
            style={styles.continueCard}
            activeOpacity={0.8}
            onPress={() => router.push(`/conversation/${suggestedScenario.id}`)}
          >
            <View style={styles.continueCardInner}>
              <View style={styles.continueInfo}>
                <View style={styles.themeBadge}>
                  <Text style={styles.themeBadgeText}>
                    {suggestedScenario.theme.replace('-', ' ')}
                  </Text>
                </View>
                <Text style={styles.continueTitle}>{suggestedScenario.titleEs}</Text>
                <Text style={styles.continueSubtitle}>{suggestedScenario.title}</Text>
                <View style={styles.continueMeta}>
                  <View style={styles.difficultyRow}>
                    {getDifficultyDots(suggestedScenario.difficulty)}
                  </View>
                  <View style={styles.timeRow}>
                    <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                    <Text style={styles.timeText}>
                      {suggestedScenario.estimatedMinutes} min
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.continueIconContainer}>
                <Ionicons name="play-circle" size={48} color={colors.deepTeal} />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Quick Start */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Start</Text>
          <View style={styles.quickStartRow}>
            <TouchableOpacity
              style={[styles.quickStartCard, styles.freeTalkCard]}
              activeOpacity={0.85}
              onPress={() => router.push('/conversation/free-talk')}
            >
              <View style={styles.quickStartIconBg}>
                <Ionicons name="chatbubble-ellipses" size={26} color={colors.white} />
              </View>
              <Text style={styles.quickStartTitle}>Free Talk</Text>
              <Text style={styles.quickStartSubtitle}>Open conversation</Text>
              <View style={styles.quickStartTimeRow}>
                <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.7)" />
                <Text style={styles.quickStartTime}>No limit</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickStartCard, styles.challengeCard]}
              activeOpacity={0.85}
              onPress={() => router.push('/conversation/daily-challenge')}
            >
              <View style={[styles.quickStartIconBg, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                <Ionicons name="flash" size={26} color={colors.white} />
              </View>
              <Text style={styles.quickStartTitle}>Today's Challenge</Text>
              <Text style={styles.quickStartSubtitle}>Timed mode</Text>
              <View style={styles.quickStartTimeRow}>
                <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.7)" />
                <Text style={styles.quickStartTime}>5 min</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Conversations */}
        <View style={[styles.section, { marginBottom: 120 }]}>
          <Text style={styles.sectionTitle}>Recent Conversations</Text>
          {MOCK_RECENT_SESSIONS.map((session) => (
            <TouchableOpacity key={session.id} style={styles.recentCard} activeOpacity={0.7}>
              <View style={styles.recentLeft}>
                <View style={styles.recentIconContainer}>
                  <Ionicons
                    name={session.scenarioTitle === 'Free Talk' ? 'chatbubble-ellipses-outline' : 'book-outline'}
                    size={20}
                    color={colors.deepTeal}
                  />
                </View>
                <View style={styles.recentInfo}>
                  <Text style={styles.recentTitle}>{session.scenarioTitleEs}</Text>
                  <Text style={styles.recentSubtitle}>
                    {session.date} \u00b7 {session.duration} min
                  </Text>
                </View>
              </View>
              <View style={styles.recentScoreContainer}>
                <Text style={styles.recentScore}>{session.score}%</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.mediumGray} />
              </View>
            </TouchableOpacity>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  greeting: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.darkText,
  },
  date: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  profileButton: {
    padding: spacing.xs,
  },
  streakCard: {
    backgroundColor: colors.deepTeal,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
    ...shadows.card,
  },
  streakLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  streakEmoji: {
    fontSize: 36,
  },
  streakCount: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
  streakMessage: {
    fontSize: typography.sizes.sm,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  streakBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: borderRadius.full,
    padding: spacing.sm,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.darkText,
    marginBottom: spacing.md,
  },
  continueCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    ...shadows.card,
  },
  continueCardInner: {
    flexDirection: 'row',
    padding: spacing.lg,
    alignItems: 'center',
  },
  continueInfo: {
    flex: 1,
  },
  themeBadge: {
    backgroundColor: '#E8F5F3',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
  },
  themeBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.deepTeal,
    textTransform: 'capitalize',
  },
  continueTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.darkText,
    marginBottom: 2,
  },
  continueSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  continueMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  difficultyRow: {
    flexDirection: 'row',
    gap: 4,
  },
  difficultyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  continueIconContainer: {
    marginLeft: spacing.md,
  },
  quickStartRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  quickStartCard: {
    flex: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.card,
  },
  freeTalkCard: {
    backgroundColor: colors.deepTeal,
  },
  challengeCard: {
    backgroundColor: colors.softOrange,
  },
  quickStartIconBg: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  quickStartTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.white,
    marginBottom: 2,
  },
  quickStartSubtitle: {
    fontSize: typography.sizes.xs,
    color: 'rgba(255, 255, 255, 0.75)',
    marginBottom: spacing.sm,
  },
  quickStartTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quickStartTime: {
    fontSize: typography.sizes.xs,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  recentCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    ...shadows.subtle,
  },
  recentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  recentIconContainer: {
    backgroundColor: '#E8F5F3',
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  recentInfo: {
    flex: 1,
  },
  recentTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.darkText,
  },
  recentSubtitle: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  recentScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  recentScore: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.deepTeal,
  },
});
