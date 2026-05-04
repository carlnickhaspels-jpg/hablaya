/**
 * Modal that lets the user send free-form feedback to the team.
 * Pick a category, type a message, submit. Calls /api/feedback via authApi.
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '@/src/constants/theme';
import { submitFeedback } from '@/src/services/authApi';
import { CLIENT_VERSION } from '@/src/constants/build';
import { trackFeedbackSubmitted } from '@/src/services/analytics';

type Category = 'bug' | 'idea' | 'praise' | 'other';

interface CategoryOption {
  key: Category;
  label: string;
  emoji: string;
}

const CATEGORIES: CategoryOption[] = [
  { key: 'bug', label: 'Bug', emoji: '🐛' },
  { key: 'idea', label: 'Idea', emoji: '💡' },
  { key: 'praise', label: 'Praise', emoji: '❤️' },
  { key: 'other', label: 'Other', emoji: '💬' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function FeedbackModal({ visible, onClose }: Props) {
  const [category, setCategory] = useState<Category>('idea');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Reset state whenever the modal is opened/closed
  useEffect(() => {
    if (visible) {
      setMessage('');
      setCategory('idea');
      setError(null);
      setSuccess(false);
      setSubmitting(false);
    }
  }, [visible]);

  const handleSubmit = async () => {
    const trimmed = message.trim();
    if (!trimmed || submitting) return;

    setError(null);
    setSubmitting(true);
    try {
      await submitFeedback({
        category,
        message: trimmed,
        clientVersion: CLIENT_VERSION,
      });
      trackFeedbackSubmitted(category);
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send feedback.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = message.trim().length > 0 && !submitting && !success;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={success ? undefined : onClose}
      >
        <TouchableOpacity
          style={styles.card}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          {success ? (
            <View style={styles.successWrap}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark" size={36} color={colors.white} />
              </View>
              <Text style={styles.successText}>Thanks for the feedback!</Text>
            </View>
          ) : (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>Send feedback</Text>
                <TouchableOpacity
                  onPress={onClose}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Close feedback"
                >
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionLabel}>Category</Text>
              <View style={styles.chipsRow}>
                {CATEGORIES.map((opt) => {
                  const selected = opt.key === category;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => setCategory(opt.key)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.chipEmoji}>{opt.emoji}</Text>
                      <Text
                        style={[
                          styles.chipLabel,
                          selected && styles.chipLabelSelected,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.sectionLabel}>Message</Text>
              <TextInput
                style={styles.input}
                value={message}
                onChangeText={setMessage}
                placeholder="What's on your mind?"
                placeholderTextColor={colors.mediumGray}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                editable={!submitting}
              />

              {error && (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={16} color={colors.errorRed} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.submitButton, !canSubmit && styles.submitDisabled]}
                onPress={handleSubmit}
                disabled={!canSubmit}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.submitText}>Send feedback</Text>
                )}
              </TouchableOpacity>
            </>
          )}
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
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.darkText,
  },
  sectionLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.borderGray,
    backgroundColor: colors.white,
  },
  chipSelected: {
    borderColor: colors.deepTeal,
    backgroundColor: colors.deepTeal,
  },
  chipEmoji: {
    fontSize: typography.sizes.base,
  },
  chipLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.darkText,
  },
  chipLabelSelected: {
    color: colors.white,
  },
  input: {
    backgroundColor: colors.lightGray,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.sizes.base,
    color: colors.darkText,
    minHeight: 110,
    maxHeight: 240,
    marginBottom: spacing.md,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.errorRed,
  },
  submitButton: {
    backgroundColor: colors.deepTeal,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  submitDisabled: {
    backgroundColor: colors.mediumGray,
  },
  submitText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.white,
  },
  successWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.successGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successText: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.darkText,
  },
});
