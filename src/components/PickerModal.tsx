import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '@/src/constants/theme';

export interface PickerOption {
  key: string;
  label: string;
  description?: string;
  destructive?: boolean;
}

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  options: PickerOption[];
  onSelect: (key: string) => void;
  onCancel: () => void;
  selectedKey?: string;
}

export default function PickerModal({
  visible,
  title,
  message,
  options,
  onSelect,
  onCancel,
  selectedKey,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onCancel}
      >
        <TouchableOpacity
          style={styles.card}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{title}</Text>
              {message ? <Text style={styles.message}>{message}</Text> : null}
            </View>
            <TouchableOpacity
              onPress={onCancel}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.optionsScroll}
            contentContainerStyle={styles.options}
          >
            {options.map((opt, idx) => {
              const selected = opt.key === selectedKey;
              return (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => onSelect(opt.key)}
                  activeOpacity={0.7}
                  style={[
                    styles.option,
                    selected && styles.optionSelected,
                    idx > 0 && styles.optionWithBorder,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.optionLabel,
                        opt.destructive && { color: colors.errorRed },
                        selected && { color: colors.deepTeal },
                      ]}
                    >
                      {opt.label}
                    </Text>
                    {opt.description ? (
                      <Text style={styles.optionDescription}>{opt.description}</Text>
                    ) : null}
                  </View>
                  {selected && (
                    <Ionicons name="checkmark-circle" size={22} color={colors.deepTeal} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancel}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
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
    maxWidth: 440,
    maxHeight: '80%',
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadows.elevated,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.darkText,
  },
  message: {
    marginTop: spacing.xs,
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: typography.sizes.sm * 1.4,
  },
  optionsScroll: {
    maxHeight: 400,
  },
  options: {
    paddingHorizontal: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginVertical: 2,
    gap: spacing.sm,
  },
  optionWithBorder: {
    // visual separator
  },
  optionSelected: {
    backgroundColor: colors.deepTeal + '0F',
  },
  optionLabel: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.darkText,
  },
  optionDescription: {
    marginTop: 2,
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  cancelButton: {
    padding: spacing.md,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.borderGray,
  },
  cancelText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
});
