import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '@/src/constants/theme';

const { width } = Dimensions.get('window');

const FEATURES = [
  {
    icon: 'mic-outline' as const,
    title: 'Speak from minute one',
    description: 'Jump straight into real conversations',
  },
  {
    icon: 'chatbubbles-outline' as const,
    title: 'Get corrected in real time',
    description: 'Instant feedback on grammar and pronunciation',
  },
  {
    icon: 'trending-up-outline' as const,
    title: 'Track your fluency',
    description: 'Watch your speaking skills grow daily',
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const featureAnims = useRef(
    FEATURES.map(() => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(20),
    }))
  ).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    featureAnims.forEach((anim, index) => {
      Animated.parallel([
        Animated.timing(anim.opacity, {
          toValue: 1,
          duration: 500,
          delay: 400 + index * 150,
          useNativeDriver: true,
        }),
        Animated.timing(anim.translateY, {
          toValue: 0,
          duration: 500,
          delay: 400 + index * 150,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, []);

  return (
    <View style={styles.container}>
      {/* Background gradient layers */}
      <View style={styles.bgTop} />
      <View style={styles.bgMiddle} />
      <View style={styles.bgBottom} />

      <SafeAreaView style={styles.safeArea}>
        <Animated.View
          style={[
            styles.heroSection,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.logoBadge}>
            <Ionicons name="chatbubble-ellipses" size={28} color={colors.white} />
          </View>
          <Text style={styles.appName}>HablaYa</Text>
          <Text style={styles.tagline}>Stop studying. Start speaking.</Text>
          <Text style={styles.subtitle}>
            Learn Spanish through real conversations with your AI tutor
          </Text>
        </Animated.View>

        <View style={styles.featuresSection}>
          {FEATURES.map((feature, index) => (
            <Animated.View
              key={feature.title}
              style={[
                styles.featureRow,
                {
                  opacity: featureAnims[index].opacity,
                  transform: [{ translateY: featureAnims[index].translateY }],
                },
              ]}
            >
              <View style={styles.featureIconContainer}>
                <Ionicons name={feature.icon} size={22} color={colors.white} />
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>
                  {feature.description}
                </Text>
              </View>
            </Animated.View>
          ))}
        </View>

        <View style={styles.bottomSection}>
          <Pressable
            style={({ pressed }) => [
              styles.getStartedButton,
              pressed && styles.getStartedButtonPressed,
            ]}
            onPress={() => router.push('/(auth)/sign-up')}
          >
            <Text style={styles.getStartedText}>Get Started</Text>
            <Ionicons name="arrow-forward" size={20} color={colors.white} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.signInLink,
              pressed && styles.signInLinkPressed,
            ]}
            onPress={() => router.push('/(auth)/sign-in')}
          >
            <Text style={styles.signInText}>I already have an account</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.deepTeal,
  },
  bgTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: colors.deepTealDark,
    borderBottomLeftRadius: 60,
    borderBottomRightRadius: 60,
  },
  bgMiddle: {
    position: 'absolute',
    top: '15%',
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  bgBottom: {
    position: 'absolute',
    bottom: '10%',
    left: -40,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  heroSection: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
  },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  appName: {
    fontSize: 44,
    fontWeight: typography.weights.extrabold,
    color: colors.white,
    letterSpacing: -1,
    marginBottom: spacing.sm,
  },
  tagline: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.semibold,
    color: colors.softOrangeLight,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.regular,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: typography.sizes.base * typography.lineHeights.relaxed,
    maxWidth: 280,
  },
  featuresSection: {
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  featureIconContainer: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.white,
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  bottomSection: {
    gap: spacing.md,
    paddingTop: spacing.lg,
  },
  getStartedButton: {
    backgroundColor: colors.softOrange,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  getStartedButtonPressed: {
    backgroundColor: colors.coral,
    transform: [{ scale: 0.98 }],
  },
  getStartedText: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
  signInLink: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  signInLinkPressed: {
    opacity: 0.7,
  },
  signInText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: 'rgba(255, 255, 255, 0.8)',
    textDecorationLine: 'underline',
    textDecorationColor: 'rgba(255, 255, 255, 0.4)',
  },
});
