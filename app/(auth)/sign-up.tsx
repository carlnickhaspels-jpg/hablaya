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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '@/src/constants/theme';
import { useApp } from '@/src/contexts/AppContext';

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp, setIsOnboarded } = useApp();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    inviteCode?: string;
    submit?: string;
  }>({});
  const [isLoading, setIsLoading] = useState(false);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const inviteRef = useRef<TextInput>(null);

  function validate(): boolean {
    const newErrors: typeof errors = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!inviteCode.trim()) {
      newErrors.inviteCode = 'Invite code is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSignUp() {
    if (!validate()) return;

    setIsLoading(true);
    setErrors((prev) => ({ ...prev, submit: undefined }));

    try {
      await signUp({
        email: email.trim().toLowerCase(),
        name: name.trim(),
        password,
        inviteCode: inviteCode.trim().toUpperCase(),
      });
      await setIsOnboarded(false);
      router.replace('/(onboarding)/level-select');
    } catch (err: any) {
      setErrors((prev) => ({ ...prev, submit: err?.message || 'Sign up failed. Please try again.' }));
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
              <Text style={styles.title}>Create account</Text>
              <Text style={styles.subtitle}>
                Start speaking Spanish in minutes
              </Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
              {/* Name field */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Name</Text>
                <View
                  style={[
                    styles.inputContainer,
                    errors.name ? styles.inputContainerError : null,
                  ]}
                >
                  <Ionicons
                    name="person-outline"
                    size={20}
                    color={errors.name ? colors.errorRed : colors.mediumGray}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Your name"
                    placeholderTextColor={colors.mediumGray}
                    value={name}
                    onChangeText={(text) => {
                      setName(text);
                      if (errors.name)
                        setErrors((prev) => ({ ...prev, name: undefined }));
                    }}
                    autoCapitalize="words"
                    autoCorrect={false}
                    returnKeyType="next"
                    onSubmitEditing={() => emailRef.current?.focus()}
                  />
                </View>
                {errors.name ? (
                  <Text style={styles.errorText}>{errors.name}</Text>
                ) : null}
              </View>

              {/* Email field */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Email</Text>
                <View
                  style={[
                    styles.inputContainer,
                    errors.email ? styles.inputContainerError : null,
                  ]}
                >
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color={errors.email ? colors.errorRed : colors.mediumGray}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    ref={emailRef}
                    style={styles.input}
                    placeholder="your@email.com"
                    placeholderTextColor={colors.mediumGray}
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      if (errors.email)
                        setErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                  />
                </View>
                {errors.email ? (
                  <Text style={styles.errorText}>{errors.email}</Text>
                ) : null}
              </View>

              {/* Password field */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Password</Text>
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
                    ref={passwordRef}
                    style={styles.input}
                    placeholder="At least 6 characters"
                    placeholderTextColor={colors.mediumGray}
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      if (errors.password)
                        setErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                    secureTextEntry={!showPassword}
                    returnKeyType="next"
                    onSubmitEditing={() => inviteRef.current?.focus()}
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
                {errors.password ? (
                  <Text style={styles.errorText}>{errors.password}</Text>
                ) : null}
              </View>

              {/* Invite code field */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Invite Code</Text>
                <View
                  style={[
                    styles.inputContainer,
                    errors.inviteCode ? styles.inputContainerError : null,
                  ]}
                >
                  <Ionicons
                    name="key-outline"
                    size={20}
                    color={errors.inviteCode ? colors.errorRed : colors.mediumGray}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    ref={inviteRef}
                    style={styles.input}
                    placeholder="HABLAYA-XXXXX"
                    placeholderTextColor={colors.mediumGray}
                    value={inviteCode}
                    onChangeText={(text) => {
                      setInviteCode(text);
                      if (errors.inviteCode)
                        setErrors((prev) => ({ ...prev, inviteCode: undefined }));
                    }}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleSignUp}
                  />
                </View>
                {errors.inviteCode ? (
                  <Text style={styles.errorText}>{errors.inviteCode}</Text>
                ) : (
                  <Text style={styles.helperText}>
                    Ask Carl for an invite code (HablaYa is in private beta).
                  </Text>
                )}
              </View>

              {/* Submit error */}
              {errors.submit ? (
                <View style={styles.submitErrorBanner}>
                  <Ionicons name="alert-circle" size={18} color={colors.errorRed} />
                  <Text style={styles.submitErrorText}>{errors.submit}</Text>
                </View>
              ) : null}

              {/* Sign up button */}
              <Pressable
                style={({ pressed }) => [
                  styles.signUpButton,
                  pressed && styles.signUpButtonPressed,
                  isLoading && styles.signUpButtonDisabled,
                ]}
                onPress={handleSignUp}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.signUpButtonText}>Create Account</Text>
                )}
              </Pressable>
            </View>

            {/* Sign in link */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <Pressable onPress={() => router.push('/(auth)/sign-in')}>
                <Text style={styles.footerLink}>Sign In</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.warmWhite,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
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
  header: {
    marginBottom: spacing.xl,
  },
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
  form: {
    gap: spacing.lg,
  },
  fieldGroup: {
    gap: spacing.sm,
  },
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
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.regular,
    color: colors.darkText,
    height: '100%',
  },
  eyeButton: {
    paddingLeft: spacing.sm,
  },
  errorText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.errorRed,
    marginLeft: spacing.xs,
  },
  helperText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
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
  signUpButton: {
    backgroundColor: colors.deepTeal,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    height: 54,
  },
  signUpButtonPressed: {
    backgroundColor: colors.deepTealDark,
    transform: [{ scale: 0.98 }],
  },
  signUpButtonDisabled: {
    opacity: 0.7,
  },
  signUpButtonText: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  footerText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.regular,
    color: colors.textSecondary,
  },
  footerLink: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.deepTeal,
  },
});
