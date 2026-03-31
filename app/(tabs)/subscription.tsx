import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, typography, spacing, borderRadius, shadows } from '@/src/constants/theme';

type PlanType = 'monthly' | 'annual';

const FEATURES = [
  {
    icon: 'infinite-outline' as const,
    title: 'Unlimited Conversations',
    description: 'Practice as much as you want, anytime',
  },
  {
    icon: 'library-outline' as const,
    title: 'All Scenarios',
    description: 'Access every conversation scenario',
  },
  {
    icon: 'mic-outline' as const,
    title: 'Pronunciation Coaching',
    description: 'Detailed feedback on your accent',
  },
  {
    icon: 'analytics-outline' as const,
    title: 'Detailed Progress',
    description: 'In-depth analytics and insights',
  },
  {
    icon: 'flash-outline' as const,
    title: 'Priority AI Speed',
    description: 'Faster response times for conversations',
  },
];

export default function SubscriptionScreen() {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('annual');

  const handleSubscribe = () => {
    Alert.alert(
      'Start Free Trial',
      `You selected the ${selectedPlan} plan. Your 7-day free trial will begin now.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start Trial', onPress: () => router.back() },
      ],
    );
  };

  const handleRestore = () => {
    Alert.alert(
      'Restore Purchase',
      'Checking for existing purchases...',
      [{ text: 'OK' }],
    );
  };

  const monthlySavings = Math.round((14.99 * 12 - 99.99) / (14.99 * 12) * 100);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Close Button */}
      <TouchableOpacity
        style={styles.closeButton}
        onPress={() => router.back()}
        activeOpacity={0.7}
      >
        <Ionicons name="close" size={28} color={colors.darkText} />
      </TouchableOpacity>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.crownContainer}>
            <Ionicons name="diamond" size={48} color={colors.softOrange} />
          </View>
          <Text style={styles.headerTitle}>Unlock Unlimited{'\n'}Speaking</Text>
          <Text style={styles.headerSubtitle}>
            Take your Spanish to the next level with full access to everything HablaYa offers
          </Text>
        </View>

        {/* Feature List */}
        <View style={styles.featureList}>
          {FEATURES.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <View style={styles.featureIconBg}>
                <Ionicons name={feature.icon} size={22} color={colors.deepTeal} />
              </View>
              <View style={styles.featureInfo}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
              <Ionicons name="checkmark-circle" size={22} color={colors.successGreen} />
            </View>
          ))}
        </View>

        {/* Pricing Cards */}
        <View style={styles.pricingSection}>
          {/* Annual Plan */}
          <TouchableOpacity
            style={[
              styles.pricingCard,
              selectedPlan === 'annual' && styles.pricingCardSelected,
            ]}
            activeOpacity={0.8}
            onPress={() => setSelectedPlan('annual')}
          >
            <View style={styles.popularBadge}>
              <Ionicons name="star" size={12} color={colors.white} />
              <Text style={styles.popularBadgeText}>Most Popular</Text>
            </View>
            <View style={styles.pricingCardInner}>
              <View style={styles.pricingLeft}>
                <View
                  style={[
                    styles.radioOuter,
                    selectedPlan === 'annual' && styles.radioOuterSelected,
                  ]}
                >
                  {selectedPlan === 'annual' && <View style={styles.radioInner} />}
                </View>
                <View>
                  <Text style={styles.pricingPlanName}>Annual</Text>
                  <Text style={styles.pricingPerMonth}>$8.33/mo</Text>
                </View>
              </View>
              <View style={styles.pricingRight}>
                <Text style={styles.pricingAmount}>$99.99</Text>
                <Text style={styles.pricingPeriod}>/year</Text>
                <View style={styles.savingsBadge}>
                  <Text style={styles.savingsText}>Save {monthlySavings}%</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>

          {/* Monthly Plan */}
          <TouchableOpacity
            style={[
              styles.pricingCard,
              selectedPlan === 'monthly' && styles.pricingCardSelected,
            ]}
            activeOpacity={0.8}
            onPress={() => setSelectedPlan('monthly')}
          >
            <View style={styles.pricingCardInner}>
              <View style={styles.pricingLeft}>
                <View
                  style={[
                    styles.radioOuter,
                    selectedPlan === 'monthly' && styles.radioOuterSelected,
                  ]}
                >
                  {selectedPlan === 'monthly' && <View style={styles.radioInner} />}
                </View>
                <View>
                  <Text style={styles.pricingPlanName}>Monthly</Text>
                  <Text style={styles.pricingPerMonth}>Billed monthly</Text>
                </View>
              </View>
              <View style={styles.pricingRight}>
                <Text style={styles.pricingAmount}>$14.99</Text>
                <Text style={styles.pricingPeriod}>/month</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* CTA Button */}
        <TouchableOpacity
          style={styles.ctaButton}
          activeOpacity={0.85}
          onPress={handleSubscribe}
        >
          <Text style={styles.ctaButtonText}>Start 7-Day Free Trial</Text>
        </TouchableOpacity>
        <Text style={styles.ctaDisclaimer}>
          Cancel anytime. You won't be charged during the trial.
        </Text>

        {/* Restore */}
        <TouchableOpacity
          style={styles.restoreButton}
          activeOpacity={0.6}
          onPress={handleRestore}
        >
          <Text style={styles.restoreText}>Restore Purchase</Text>
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.warmWhite,
  },
  closeButton: {
    position: 'absolute',
    top: 56,
    right: spacing.lg,
    zIndex: 10,
    backgroundColor: colors.lightGray,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  crownContainer: {
    backgroundColor: '#FFF3E0',
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  headerTitle: {
    fontSize: typography.sizes.xxxl,
    fontWeight: typography.weights.bold,
    color: colors.darkText,
    textAlign: 'center',
    lineHeight: typography.sizes.xxxl * typography.lineHeights.tight,
    marginBottom: spacing.sm,
  },
  headerSubtitle: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.sizes.base * typography.lineHeights.normal,
    paddingHorizontal: spacing.md,
  },
  featureList: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    ...shadows.card,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  featureIconBg: {
    backgroundColor: '#E8F5F3',
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  featureInfo: {
    flex: 1,
  },
  featureTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.darkText,
  },
  featureDescription: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  pricingSection: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  pricingCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.borderGray,
    overflow: 'hidden',
    ...shadows.subtle,
  },
  pricingCardSelected: {
    borderColor: colors.deepTeal,
    backgroundColor: '#FAFFFE',
  },
  popularBadge: {
    backgroundColor: colors.softOrange,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 4,
  },
  popularBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
  pricingCardInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
  },
  pricingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.borderGray,
    justifyContent: 'center',
    alignItems: 'center',
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
  pricingPlanName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.darkText,
  },
  pricingPerMonth: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  pricingRight: {
    alignItems: 'flex-end',
  },
  pricingAmount: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.darkText,
  },
  pricingPeriod: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  savingsBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs,
  },
  savingsText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    color: colors.successGreen,
  },
  ctaButton: {
    backgroundColor: colors.softOrange,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    ...shadows.card,
  },
  ctaButtonText: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
  ctaDisclaimer: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  restoreText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.deepTeal,
    textDecorationLine: 'underline',
  },
});
