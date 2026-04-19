import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '@/src/constants/theme';
import { improveSentence, ImprovedSentence } from '@/src/services/ai';
import { playAudio } from '@/src/services/speech';

interface Props {
  text: string | null;
  onClose: () => void;
}

export default function ImprovePopup({ text, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImprovedSentence | null>(null);

  useEffect(() => {
    if (!text) {
      setResult(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setResult(null);
    improveSentence(text).then((r) => {
      if (!cancelled) {
        setResult(r);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [text]);

  if (!text) return null;

  return (
    <Modal
      visible={!!text}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          style={styles.card}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="sparkles" size={20} color={colors.softOrange} />
              <Text style={styles.title}>Native version</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>You said</Text>
            <Text style={styles.original} selectable>{text}</Text>
          </View>

          {loading ? (
            <ActivityIndicator size="small" color={colors.deepTeal} style={styles.loader} />
          ) : result && result.improved ? (
            <>
              <View style={styles.improvedSection}>
                <View style={styles.improvedHeader}>
                  <Text style={styles.label}>Native speaker would say</Text>
                  <TouchableOpacity
                    onPress={() => playAudio(result.improved)}
                    style={styles.speakerButton}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="play-circle" size={26} color={colors.deepTeal} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.improved} selectable>{result.improved}</Text>
              </View>

              {result.explanation && (
                <View style={styles.explanationBox}>
                  <Ionicons name="information-circle" size={16} color={colors.softOrange} />
                  <Text style={styles.explanation}>{result.explanation}</Text>
                </View>
              )}
            </>
          ) : null}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.elevated,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.darkText,
  },
  section: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  original: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  loader: {
    paddingVertical: spacing.lg,
  },
  improvedSection: {
    backgroundColor: colors.deepTeal + '0A',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.deepTeal,
    marginBottom: spacing.md,
  },
  improvedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  improved: {
    fontSize: typography.sizes.lg,
    color: colors.darkText,
    fontWeight: typography.weights.semibold,
    lineHeight: typography.sizes.lg * typography.lineHeights.normal,
  },
  speakerButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  explanationBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.softOrange + '12',
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  explanation: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.darkText,
    lineHeight: typography.sizes.sm * typography.lineHeights.normal,
  },
});
