import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '@/src/constants/theme';
import { requestPasswordReset } from '@/src/services/authApi';

export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [didSubmit, setDidSubmit] = useState(false);
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

  function validate(): boolean {
    if (!email.trim()) {
      setEmailError('Email is required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError('Please enter a valid email');
      return false;
    }
    setEmailError(undefined);
    return true;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setIsLoading(true);
    setSubmitError(undefined);
    try {
      await requestPasswordReset(email.trim().toLowerCase());
      setDidSubmit(true);
    } catch (err: any) {
      setSubmitError(err?.message || 'Could not send reset email.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Back button */}
            <Pressable
              style={styles.backButton}
              onPress={() => router.back()}
              hitSlop={12}
            >
              <Ionicons name="arrow-back" size={24} color={colors.darkText} />
            </Pressable>

            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Reset your password</Text>
              <Text style={styles.subtitle}>
                {didSubmit
                  ? "If an account exists with that email, we've sent a reset link. Check your inbox (and spam folder)."
                  : 'Enter your email and we’ll send you a link to reset your password.'}
              </Text>
            </View>

            {!didSubmit ? (
              <View style={styles.form}>
                {/* Email field */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Email</Text>
                  <View
                    style={[
                      styles.inputContainer,
                      emailError ? styles.inputContainerError : null,
                    ]}
                  >
                    <Ionicons
                      name="mail-outline"
                      size={20}
                      color={emailError ? colors.errorRed : colors.mediumGray}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="your@email.com"
                      placeholderTextColor={colors.mediumGray}
                      value={email}
                      onChangeText={(text) => {
                        setEmail(text);
                        if (emailError) setEmailError(undefined);
                      }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="done"
                      onSubmitEditing={handleSubmit}
                    />
                  </View>
                  {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
                </View>

                {submitError ? (
                  <View style={styles.submitErrorBanner}>
                    <Ionicons name="alert-circle" size={18} color={colors.errorRed} />
                    <Text style={styles.submitErrorText}>{submitError}</Text>
                  </View>
                ) : null}

                <Pressable
                  style={({ pressed }) => [
                    styles.submitButton,
                    pressed && styles.submitButtonPressed,
                    isLoading && styles.submitButtonDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <Text style={styles.submitButtonText}>Send reset link</Text>
                  )}
                </Pressable>
              </View>
            ) : (
              <View style={styles.successBlock}>
                <View style={styles.successIcon}>
                  <Ionicons name="checkmark" size={36} color={colors.deepTeal} />
                </View>
                <Pressable
                  style={({ pressed }) => [
                    styles.submitButton,
                    pressed && styles.submitButtonPressed,
                  ]}
                  onPress={() => router.replace('/(auth)/sign-in')}
                >
                  <Text style={styles.submitButtonText}>Back to sign in</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.warmWhite },
  safeArea: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.subtle,
    marginBottom: spacing.xl,
  },
  header: { marginBottom: spacing.xl },
  title: {
    fontSize: typography.sizes.xxxl,
    fontWeight: typography.weights.bold,
    color: colors.darkText,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.regular,
    color: colors.textSecondary,
    lineHeight: typography.sizes.base * typography.lineHeights.relaxed,
  },
  form: { gap: spacing.lg },
  fieldGroup: { gap: spacing.sm },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.darkText,
    marginLeft: spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.borderGray,
    paddingHorizontal: spacing.md,
    height: 52,
  },
  inputContainerError: {
    borderColor: colors.errorRed,
    backgroundColor: '#FFF5F5',
  },
  inputIcon: { marginRight: spacing.sm },
  input: {
    flex: 1,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.regular,
    color: colors.darkText,
    height: '100%',
  },
  errorText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.errorRed,
    marginLeft: spacing.xs,
  },
  submitErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.errorRed + '10',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.errorRed + '40',
  },
  submitErrorText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.errorRed,
  },
  submitButton: {
    backgroundColor: colors.deepTeal,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    height: 54,
  },
  submitButtonPressed: {
    backgroundColor: colors.deepTealDark,
    transform: [{ scale: 0.98 }],
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitButtonText: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
  successBlock: {
    alignItems: 'center',
    gap: spacing.xl,
    paddingTop: spacing.lg,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8F5F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
