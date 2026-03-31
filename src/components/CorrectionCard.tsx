import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Correction, CorrectionType } from '../types';
import { colors, typography, spacing, borderRadius } from '../constants/theme';

interface CorrectionCardProps {
  correction: Correction;
}

const TYPE_CONFIG: Record<
  CorrectionType,
  { color: string; label: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  grammar: {
    color: '#F2994A',
    label: 'Grammar',
    icon: 'document-text-outline',
  },
  vocabulary: {
    color: '#3B82F6',
    label: 'Vocabulary',
    icon: 'book-outline',
  },
  pronunciation: {
    color: '#E85D4A',
    label: 'Pronunciation',
    icon: 'mic-outline',
  },
};

export default function CorrectionCard({ correction }: CorrectionCardProps) {
  const config = TYPE_CONFIG[correction.type];

  return (
    <View style={[styles.card, { borderLeftColor: config.color }]}>
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: config.color + '18' }]}>
          <Ionicons name={config.icon} size={14} color={config.color} />
          <Text style={[styles.badgeText, { color: config.color }]}>
            {config.label}
          </Text>
        </View>
        {correction.severity === 'important' && (
          <View style={styles.severityBadge}>
            <Text style={styles.severityText}>Important</Text>
          </View>
        )}
      </View>

      <View style={styles.correctionRow}>
        <View style={styles.correctionItem}>
          <Ionicons name="close-circle" size={16} color={colors.errorRed} />
          <Text style={styles.originalText}>{correction.original}</Text>
        </View>
        <View style={styles.correctionItem}>
          <Ionicons name="checkmark-circle" size={16} color={colors.successGreen} />
          <Text style={styles.correctedText}>{correction.corrected}</Text>
        </View>
      </View>

      <Text style={styles.explanation}>{correction.explanation}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    borderLeftWidth: 4,
    padding: spacing.md,
    marginVertical: spacing.xs,
    marginHorizontal: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  badgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  severityBadge: {
    backgroundColor: colors.errorRed + '15',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  severityText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.errorRed,
  },
  correctionRow: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  correctionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  originalText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
    lineHeight: typography.sizes.sm * typography.lineHeights.normal,
  },
  correctedText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.darkText,
    fontWeight: typography.weights.bold,
    lineHeight: typography.sizes.sm * typography.lineHeights.normal,
  },
  explanation: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: typography.sizes.sm * typography.lineHeights.relaxed,
  },
});
