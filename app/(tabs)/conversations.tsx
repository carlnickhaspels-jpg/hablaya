import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, typography, spacing, borderRadius, shadows } from '@/src/constants/theme';
import { scenarios, getScenariosByTheme } from '@/src/constants/scenarios';
import { Scenario, ScenarioTheme } from '@/src/types';

type FilterTab = 'all' | ScenarioTheme;

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'travel', label: 'Travel' },
  { key: 'social', label: 'Social' },
  { key: 'daily-life', label: 'Daily Life' },
  { key: 'work', label: 'Work' },
];

const THEME_ICONS: Record<ScenarioTheme, keyof typeof Ionicons.glyphMap> = {
  travel: 'airplane-outline',
  social: 'people-outline',
  'daily-life': 'home-outline',
  work: 'briefcase-outline',
};

const THEME_COLORS: Record<ScenarioTheme, string> = {
  travel: '#3B82F6',
  social: '#EC4899',
  'daily-life': '#F59E0B',
  work: '#8B5CF6',
};

export default function ConversationsScreen() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  const filteredScenarios = useMemo(() => {
    if (activeFilter === 'all') return scenarios;
    return getScenariosByTheme(activeFilter);
  }, [activeFilter]);

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

  const renderFreeTalkCard = () => (
    <TouchableOpacity
      style={styles.freeTalkCard}
      activeOpacity={0.85}
      onPress={() => router.push('/conversation/free-talk')}
    >
      <View style={styles.freeTalkInner}>
        <View style={styles.freeTalkIconBg}>
          <Ionicons name="chatbubble-ellipses" size={28} color={colors.white} />
        </View>
        <View style={styles.freeTalkInfo}>
          <Text style={styles.freeTalkTitle}>Conversaci\u00f3n Libre</Text>
          <Text style={styles.freeTalkSubtitle}>Free Talk</Text>
          <Text style={styles.freeTalkDescription}>
            Practice speaking about anything you want with your AI tutor
          </Text>
        </View>
        <Ionicons name="arrow-forward-circle" size={32} color="rgba(255,255,255,0.8)" />
      </View>
    </TouchableOpacity>
  );

  const renderScenarioCard = useCallback(
    ({ item }: { item: Scenario }) => (
      <TouchableOpacity
        style={styles.scenarioCard}
        activeOpacity={0.7}
        onPress={() => router.push(`/conversation/${item.id}`)}
      >
        <View style={styles.scenarioCardTop}>
          <View
            style={[
              styles.scenarioThemeBadge,
              { backgroundColor: THEME_COLORS[item.theme] + '15' },
            ]}
          >
            <Ionicons
              name={THEME_ICONS[item.theme]}
              size={14}
              color={THEME_COLORS[item.theme]}
            />
            <Text
              style={[styles.scenarioThemeBadgeText, { color: THEME_COLORS[item.theme] }]}
            >
              {item.theme.replace('-', ' ')}
            </Text>
          </View>
          <View style={styles.scenarioTimeRow}>
            <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.scenarioTimeText}>{item.estimatedMinutes} min</Text>
          </View>
        </View>

        <Text style={styles.scenarioTitleEs}>{item.titleEs}</Text>
        <Text style={styles.scenarioTitleEn}>{item.title}</Text>
        <Text style={styles.scenarioDescription} numberOfLines={2}>
          {item.description}
        </Text>

        <View style={styles.scenarioCardBottom}>
          <View style={styles.difficultyRow}>
            <Text style={styles.difficultyLabel}>Level</Text>
            <View style={styles.difficultyDots}>{getDifficultyDots(item.difficulty)}</View>
          </View>
          <View style={styles.startButton}>
            <Ionicons name="play" size={14} color={colors.white} />
            <Text style={styles.startButtonText}>Start</Text>
          </View>
        </View>
      </TouchableOpacity>
    ),
    [router],
  );

  const keyExtractor = useCallback((item: Scenario) => item.id, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Conversations</Text>
          <Text style={styles.headerSubtitle}>
            {scenarios.length} scenarios available
          </Text>
        </View>

        {/* Filter Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterContainer}
          contentContainerStyle={styles.filterContent}
        >
          {FILTER_TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.filterTab,
                activeFilter === tab.key && styles.filterTabActive,
              ]}
              onPress={() => setActiveFilter(tab.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterTabText,
                  activeFilter === tab.key && styles.filterTabTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Scenarios List */}
        <FlatList
          data={filteredScenarios}
          renderItem={renderScenarioCard}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderFreeTalkCard}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          ListFooterComponent={<View style={{ height: 120 }} />}
        />
      </View>
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
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
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
  filterContainer: {
    maxHeight: 48,
    marginBottom: spacing.md,
  },
  filterContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  filterTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderGray,
  },
  filterTabActive: {
    backgroundColor: colors.deepTeal,
    borderColor: colors.deepTeal,
  },
  filterTabText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  filterTabTextActive: {
    color: colors.white,
    fontWeight: typography.weights.semibold,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
  },
  freeTalkCard: {
    backgroundColor: colors.deepTeal,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  freeTalkInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  freeTalkIconBg: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 52,
    height: 52,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  freeTalkInfo: {
    flex: 1,
  },
  freeTalkTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
  freeTalkSubtitle: {
    fontSize: typography.sizes.sm,
    color: 'rgba(255, 255, 255, 0.75)',
    marginBottom: 4,
  },
  freeTalkDescription: {
    fontSize: typography.sizes.xs,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  scenarioCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.card,
  },
  scenarioCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  scenarioThemeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  scenarioThemeBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    textTransform: 'capitalize',
  },
  scenarioTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scenarioTimeText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  scenarioTitleEs: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.darkText,
    marginBottom: 2,
  },
  scenarioTitleEn: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  scenarioDescription: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: typography.sizes.sm * typography.lineHeights.normal,
    marginBottom: spacing.md,
  },
  scenarioCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  difficultyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  difficultyLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  difficultyDots: {
    flexDirection: 'row',
    gap: 4,
  },
  difficultyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.deepTeal,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  startButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.white,
  },
});
