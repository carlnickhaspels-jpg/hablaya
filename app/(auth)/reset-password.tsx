import React, { useState, useRef } from 'react';
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '@/src/constants/theme';
import { resetPassword } from '@/src/services/authApi';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string; submit?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [didSucceed, setDidSucceed] = useState(false);

  const confirmRef = useRef<TextInput>(null);

  // If the URL has no token at all, this link is broken / not from email
  const hasToken = typeof token === 'string' && token.length > 0;

  function validate(): boolean {
    const newErrors: typeof errors = {};
    if (!password) newErrors.password = 'Password is required';
    else if (password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    if (!confirm) newErrors.confirm = 'Please confirm your password';
    else if (confirm !== password) newErrors.confirm = "Passwords don't match";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit() {
    if (!hasToken) {
      setErrors({ submit: 'No reset token found in the link. Request a new reset email.' });
      return;
    }
    if (!validate()) return;

    setIsLoading(true);
    setErrors((prev) => ({ ...prev, submit: undefined }));
    try {
      await resetPassword(token, password);
      setDidSucceed(true);
    } catch (err: any) {
      setErrors((prev) => ({ ...prev, submit: err?.message || 'Could not reset password.' }));
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
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Set a new password</Text>
              <Text style={styles.subtitle}>
                {didSucceed
                  ? "Your password is updated. Sign in with the new one."
                  : hasToken
                  ? 'Enter and confirm your new password.'
                  : 'This reset link is missing a token. Request a new reset email.'}
              </Text>
            </View>

            {!didSucceed && hasToken ? (
              <View style={styles.form}>
                {/* Password field */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>New password</Text>
                  <View
                    style={[
                      styles.inputContainer,
                      errors.password ? styles.inputContainerError : null,
                    ]}
                  >
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color={errors.password ? colors.errorRed : colors.mediumGray}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="At least 6 characters"
                      placeholderTextColor={colors.mediumGray}
                      value={password}
                      onChangeText={(text) => {
                        setPassword(text);
                        if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
                      }}
                      secureTextEntry={!showPassword}
                      returnKeyType="next"
                      onSubmitEditing={() => confirmRef.current?.focus()}
                    />
                    <Pressable
                      onPress={() => setShowPassword(!showPassword)}
                      hitSlop={8}
                      style={styles.eyeButton}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color={colors.mediumGray}
                      />
                    </Pressable>
                  </View>
                  {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
                </View>

                {/* Confirm field */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Confirm new password</Text>
                  <View
                    style={[
                      styles.inputContainer,
                      errors.confirm ? styles.inputContainerError : null,
                    ]}
                  >
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color={errors.confirm ? colors.errorRed : colors.mediumGray}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      ref={confirmRef}
                      style={styles.input}
                      placeholder="Repeat password"
                      placeholderTextColor={colors.mediumGray}
                      value={confirm}
                      onChangeText={(text) => {
                        setConfirm(text);
                        if (errors.confirm) setErrors((p) => ({ ...p, confirm: undefined }));
                      }}
                      secureTextEntry={!showPassword}
                      returnKeyType="done"
                      onSubmitEditing={handleSubmit}
                    />
                  </View>
                  {errors.confirm ? <Text style={styles.errorText}>{errors.confirm}</Text> : null}
                </View>

                {errors.submit ? (
                  <View style={styles.submitErrorBanner}>
                    <Ionicons name="alert-circle" size={18} color={colors.errorRed} />
                    <Text style={styles.submitErrorText}>{errors.submit}</Text>
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
                    <Text style={styles.submitButtonText}>Update password</Text>
                  )}
                </Pressable>
              </View>
            ) : (
              <View style={styles.successBlock}>
                <View style={styles.successIcon}>
                  <Ionicons
                    name={didSucceed ? 'checkmark' : 'alert-circle-outline'}
                    size={36}
                    color={didSucceed ? colors.deepTeal : colors.errorRed}
                  />
                </View>
                <Pressable
                  style={({ pressed }) => [
                    styles.submitButton,
                    pressed && styles.submitButtonPressed,
                  ]}
                  onPress={() =>
                    router.replace(didSucceed ? '/(auth)/sign-in' : '/(auth)/forgot-password')
                  }
                >
                  <Text style={styles.submitButtonText}>
                    {didSucceed ? 'Sign in' : 'Request new link'}
                  </Text>
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
  header: { marginBottom: spacing.xl, marginTop: spacing.xl },
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
  eyeButton: { paddingLeft: spacing.sm },
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
  successBlock: { alignItems: 'center', gap: spacing.xl, paddingTop: spacing.lg },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8F5F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
