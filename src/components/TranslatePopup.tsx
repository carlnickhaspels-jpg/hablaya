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
import { translateText, TranslationResult } from '@/src/services/ai';
import { playAudio } from '@/src/services/speech';

interface Props {
  text: string | null;
  context?: string;
  onClose: () => void;
}

export default function TranslatePopup({ text, context, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TranslationResult | null>(null);

  useEffect(() => {
    if (!text) {
      setResult(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setResult(null);
    translateText(text, context).then((r) => {
      if (!cancelled) {
        setResult(r);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [text, context]);

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
              <Text style={styles.spanish} selectable>{text}</Text>
              <TouchableOpacity
                onPress={() => playAudio(text)}
                style={styles.speakerButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="volume-medium" size={20} color={colors.deepTeal} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="small" color={colors.deepTeal} style={styles.loader} />
          ) : result ? (
            <View style={styles.body}>
              {result.partOfSpeech && (
                <Text style={styles.pos}>{result.partOfSpeech}</Text>
              )}

              <View style={styles.translationRow}>
                <Text style={styles.flag}>🇬🇧</Text>
                <Text style={styles.translation} selectable>{result.translation}</Text>
              </View>

              {result.translationNl && (
                <View style={styles.translationRow}>
                  <Text style={styles.flag}>🇳🇱</Text>
                  <Text style={styles.translation} selectable>{result.translationNl}</Text>
                </View>
              )}

              {result.example && (
                <View style={styles.exampleBox}>
                  <Text style={styles.exampleLabel}>Example</Text>
                  <Text style={styles.example} selectable>{result.example}</Text>
                  <TouchableOpacity
                    onPress={() => playAudio(result.example || '')}
                    style={styles.examplePlay}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="play-circle" size={22} color={colors.deepTeal} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  spanish: {
    flex: 1,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.darkText,
  },
  speakerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.deepTeal + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: {
    paddingVertical: spacing.lg,
  },
  body: {
    gap: spacing.sm + 2,
  },
  pos: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontStyle: 'italic',
    textTransform: 'lowercase',
  },
  translationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  flag: {
    fontSize: typography.sizes.lg,
  },
  translation: {
    flex: 1,
    fontSize: typography.sizes.base,
    color: colors.darkText,
    fontWeight: typography.weights.medium,
  },
  exampleBox: {
    marginTop: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.deepTeal + '0A',
    borderRadius: borderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.deepTeal,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  exampleLabel: {
    position: 'absolute',
    top: -8,
    left: 8,
    backgroundColor: colors.white,
    paddingHorizontal: 4,
    fontSize: typography.sizes.xs,
    color: colors.deepTeal,
    fontWeight: typography.weights.semibold,
  },
  example: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.darkText,
    fontStyle: 'italic',
    lineHeight: typography.sizes.sm * typography.lineHeights.normal,
  },
  examplePlay: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
