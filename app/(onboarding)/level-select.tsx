import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '@/src/constants/theme';

type LevelOption = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  param: string;
};

const LEVELS: LevelOption[] = [
  {
    id: 'beginner',
    icon: 'leaf-outline',
    title: 'Complete beginner',
    description: 'I\'ve never studied Spanish before',
    param: 'beginner',
  },
  {
    id: 'basics',
    icon: 'bulb-outline',
    title: 'Know some basics',
    description: 'I can say a few phrases like "hola" and "gracias"',
    param: 'basics',
  },
  {
    id: 'intermediate',
    icon: 'chatbubble-outline',
    title: 'Intermediate',
    description: 'I can hold simple conversations',
    param: 'intermediate',
  },
  {
    id: 'advanced',
    icon: 'rocket-outline',
    title: 'Advanced',
    description: 'I want to perfect my fluency and sound natural',
    param: 'advanced',
  },
];

export default function LevelSelectScreen() {
  const router = useRouter();
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);

  const cardAnims = useRef(
    LEVELS.map(() => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(24),
    }))
  ).current;

  useEffect(() => {
    cardAnims.forEach((anim, index) => {
      Animated.parallel([
        Animated.timing(anim.opacity, {
          toValue: 1,
          duration: 400,
          delay: 100 + index * 120,
          useNativeDriver: true,
        }),
        Animated.timing(anim.translateY, {
          toValue: 0,
          duration: 400,
          delay: 100 + index * 120,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, []);

  function handleSelect(level: LevelOption) {
    setSelectedLevel(level.id);

    // Brief delay so the user sees the selection before navigating
    setTimeout(() => {
      router.push({
        pathname: '/(onboarding)/assessment',
        params: { level: level.param },
      });
    }, 300);
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
            <View style={styles.progressDotActive} />
            <View style={styles.progressDot} />
            <View style={styles.progressDot} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>What's your{'\n'}Spanish level?</Text>
            <Text style={styles.subtitle}>
              We'll personalize your experience based on where you are right now
            </Text>
          </View>

          {/* Level cards */}
          <View style={styles.cardsContainer}>
            {LEVELS.map((level, index) => {
              const isSelected = selectedLevel === level.id;

              return (
                <Animated.View
                  key={level.id}
                  style={{
                    opacity: cardAnims[index].opacity,
                    transform: [{ translateY: cardAnims[index].translateY }],
                  }}
                >
                  <Pressable
                    style={({ pressed }) => [
                      styles.card,
                      isSelected && styles.cardSelected,
                      pressed && !isSelected && styles.cardPressed,
                    ]}
                    onPress={() => handleSelect(level)}
                  >
                    <View
                      style={[
                        styles.cardIconContainer,
                        isSelected && styles.cardIconContainerSelected,
                      ]}
                    >
                      <Ionicons
                        name={level.icon}
                        size={24}
                        color={isSelected ? colors.white : colors.deepTeal}
                      />
                    </View>

                    <View style={styles.cardContent}>
                      <Text
                        style={[
                          styles.cardTitle,
                          isSelected && styles.cardTitleSelected,
                        ]}
                      >
                        {level.title}
                      </Text>
                      <Text
                        style={[
                          styles.cardDescription,
                          isSelected && styles.cardDescriptionSelected,
                        ]}
                      >
                        {level.description}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.radioOuter,
                        isSelected && styles.radioOuterSelected,
                      ]}
                    >
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        </ScrollView>
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
    paddingBottom: spacing.xxl,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
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
    fontSize: typography.sizes.xxxl,
    fontWeight: typography.weights.bold,
    color: colors.darkText,
    lineHeight: typography.sizes.xxxl * typography.lineHeights.tight,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.regular,
    color: colors.textSecondary,
    lineHeight: typography.sizes.base * typography.lineHeights.relaxed,
  },
  cardsContainer: {
    gap: spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.borderGray,
    gap: spacing.md,
    ...shadows.subtle,
  },
  cardSelected: {
    borderColor: colors.deepTeal,
    backgroundColor: '#F0FAF9',
    ...shadows.card,
  },
  cardPressed: {
    backgroundColor: colors.lightGray,
  },
  cardIconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: '#E8F5F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconContainerSelected: {
    backgroundColor: colors.deepTeal,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.darkText,
    marginBottom: 2,
  },
  cardTitleSelected: {
    color: colors.deepTealDark,
  },
  cardDescription: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
    color: colors.textSecondary,
    lineHeight: typography.sizes.sm * typography.lineHeights.normal,
  },
  cardDescriptionSelected: {
    color: colors.deepTeal,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.borderGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: colors.deepTeal,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.deepTeal,
  },
});
