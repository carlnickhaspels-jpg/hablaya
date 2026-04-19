import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '@/src/constants/theme';
import { playAudio } from '@/src/services/speech';

interface Props {
  hint: string | null;
  loading: boolean;
  onClose: () => void;
}

export default function HintBar({ hint, loading, onClose }: Props) {
  if (!hint && !loading) return null;

  return (
    <View style={styles.container}>
      <View style={styles.icon}>
        <Ionicons name="bulb" size={20} color={colors.softOrange} />
      </View>

      <View style={styles.body}>
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.softOrange} />
            <Text style={styles.loadingText}>Thinking of a hint…</Text>
          </View>
        ) : hint ? (
          <>
            <Text style={styles.label}>Try saying</Text>
            <Text style={styles.hintText} selectable>{hint}</Text>
          </>
        ) : null}
      </View>

      {hint && !loading && (
        <TouchableOpacity
          onPress={() => playAudio(hint)}
          style={styles.playButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="play-circle" size={28} color={colors.deepTeal} />
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPress={onClose}
        style={styles.closeButton}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.softOrange + '12',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.softOrange + '40',
    ...shadows.subtle,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.softOrange + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: typography.sizes.xs,
    color: colors.softOrange,
    fontWeight: typography.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hintText: {
    fontSize: typography.sizes.base,
    color: colors.darkText,
    fontWeight: typography.weights.medium,
    lineHeight: typography.sizes.base * 1.3,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  playButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
