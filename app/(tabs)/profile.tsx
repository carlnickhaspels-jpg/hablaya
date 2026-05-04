import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, typography, spacing, borderRadius, shadows } from '@/src/constants/theme';
import { useApp } from '@/src/contexts/AppContext';
import type { FluencyLevel } from '@/src/types';

const LEVEL_DISPLAY: Record<string, string> = {
  silencioso: 'Silencioso',
  principiante: 'Principiante',
  conversador: 'Conversador',
  fluido: 'Fluido',
  nativo: 'Nativo',
};

const LEVEL_DESCRIPTIONS: Record<string, string> = {
  silencioso: 'Beginner — first words',
  principiante: 'Basics — short sentences',
  conversador: 'Intermediate — full conversations',
  fluido: 'Fluent — nuance and complexity',
  nativo: 'Native-like — refining accent',
};

interface SettingRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  isToggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (value: boolean) => void;
  onPress?: () => void;
  showChevron?: boolean;
  iconColor?: string;
}

function SettingRow({
  icon,
  label,
  value,
  isToggle,
  toggleValue,
  onToggle,
  onPress,
  showChevron = true,
  iconColor = colors.deepTeal,
}: SettingRowProps) {
  const content = (
    <View style={styles.settingRow}>
      <View style={styles.settingLeft}>
        <View style={[styles.settingIconBg, { backgroundColor: iconColor + '15' }]}>
          <Ionicons name={icon} size={20} color={iconColor} />
        </View>
        <Text style={styles.settingLabel}>{label}</Text>
      </View>
      <View style={styles.settingRight}>
        {isToggle ? (
          <Switch
            value={toggleValue}
            onValueChange={onToggle}
            trackColor={{ false: colors.borderGray, true: colors.deepTeal }}
            thumbColor={colors.white}
          />
        ) : (
          <>
            {value && <Text style={styles.settingValue}>{value}</Text>}
            {showChevron && (
              <Ionicons name="chevron-forward" size={18} color={colors.mediumGray} />
            )}
          </>
        )}
      </View>
    </View>
  );

  if (isToggle) return content;

  return (
    <TouchableOpacity activeOpacity={0.6} onPress={onPress}>
      {content}
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const { user, setUser, setIsOnboarded } = useApp();
  const router = useRouter();

  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const [tutorVoice, setTutorVoice] = React.useState('Female - Natural');
  const [speakingSpeed, setSpeakingSpeed] = React.useState('Normal');
  const [correctionIntensity, setCorrectionIntensity] = React.useState('Important only');

  const userName = user?.name ?? 'Student';
  const userEmail = user?.email ?? 'student@hablaya.com';
  const userLevel = user?.level ?? 'principiante';
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : 'March 2026';
  const isPremium = user?.isPremium ?? false;

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            setUser(null);
            router.replace('/(auth)/welcome');
          },
        },
      ],
    );
  };

  const handleVoiceSelect = () => {
    Alert.alert('Tutor Voice', 'Select a voice for your tutor:', [
      { text: 'Female - Natural', onPress: () => setTutorVoice('Female - Natural') },
      { text: 'Male - Natural', onPress: () => setTutorVoice('Male - Natural') },
      { text: 'Female - Warm', onPress: () => setTutorVoice('Female - Warm') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSpeedSelect = () => {
    Alert.alert('Speaking Speed', 'Choose the tutor speaking speed:', [
      { text: 'Slow', onPress: () => setSpeakingSpeed('Slow') },
      { text: 'Normal', onPress: () => setSpeakingSpeed('Normal') },
      { text: 'Fast', onPress: () => setSpeakingSpeed('Fast') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleCorrectionSelect = () => {
    Alert.alert('Correction Intensity', 'How often should the tutor correct you?', [
      { text: 'All errors', onPress: () => setCorrectionIntensity('All errors') },
      { text: 'Important only', onPress: () => setCorrectionIntensity('Important only') },
      { text: 'Flow mode (minimal)', onPress: () => setCorrectionIntensity('Flow mode') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const updateLevel = (newLevel: FluencyLevel) => {
    if (!user) return;
    setUser({ ...user, level: newLevel });
  };

  const handleLevelSelect = () => {
    Alert.alert(
      'Spanish Level',
      'Pick the level that matches your current Spanish ability. Your tutor will adjust the difficulty.',
      [
        {
          text: `${LEVEL_DISPLAY.silencioso} — ${LEVEL_DESCRIPTIONS.silencioso}`,
          onPress: () => updateLevel('silencioso'),
        },
        {
          text: `${LEVEL_DISPLAY.principiante} — ${LEVEL_DESCRIPTIONS.principiante}`,
          onPress: () => updateLevel('principiante'),
        },
        {
          text: `${LEVEL_DISPLAY.conversador} — ${LEVEL_DESCRIPTIONS.conversador}`,
          onPress: () => updateLevel('conversador'),
        },
        {
          text: `${LEVEL_DISPLAY.fluido} — ${LEVEL_DESCRIPTIONS.fluido}`,
          onPress: () => updateLevel('fluido'),
        },
        {
          text: `${LEVEL_DISPLAY.nativo} — ${LEVEL_DESCRIPTIONS.nativo}`,
          onPress: () => updateLevel('nativo'),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleRetakeAssessment = () => {
    Alert.alert(
      'Retake Speaking Assessment',
      'Want to retake the spoken level assessment? This will not change your progress, only your assigned level.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Retake',
          onPress: () => {
            // Temporarily clear onboarded so the auth router lets us
            // through to the onboarding stack. The results screen will
            // re-enable onboarded when the user finishes.
            setIsOnboarded(false);
            router.push('/(onboarding)/level-select');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        {/* User Info Card */}
        <View style={styles.userCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {userName.charAt(0).toUpperCase()}
              </Text>
            </View>
            {isPremium && (
              <View style={styles.premiumBadgeSmall}>
                <Ionicons name="star" size={10} color={colors.white} />
              </View>
            )}
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{userName}</Text>
            <Text style={styles.userEmail}>{userEmail}</Text>
            <View style={styles.userMeta}>
              <View style={styles.levelBadge}>
                <Text style={styles.levelBadgeText}>{LEVEL_DISPLAY[userLevel]}</Text>
              </View>
              <Text style={styles.memberSince}>Member since {memberSince}</Text>
            </View>
          </View>
        </View>

        {/* Spanish Level */}
        <View style={styles.settingSection}>
          <Text style={styles.sectionTitle}>Your Spanish</Text>
          <View style={styles.settingGroup}>
            <SettingRow
              icon="trending-up-outline"
              label="Spanish Level"
              value={LEVEL_DISPLAY[userLevel]}
              onPress={handleLevelSelect}
              iconColor={colors.softOrange}
            />
            <View style={styles.settingDivider} />
            <SettingRow
              icon="refresh-outline"
              label="Retake Speaking Assessment"
              onPress={handleRetakeAssessment}
              iconColor={colors.deepTeal}
            />
          </View>
        </View>

        {/* Speaking Preferences */}
        <View style={styles.settingSection}>
          <Text style={styles.sectionTitle}>Speaking Preferences</Text>
          <View style={styles.settingGroup}>
            <SettingRow
              icon="mic-outline"
              label="Tutor Voice"
              value={tutorVoice}
              onPress={handleVoiceSelect}
            />
            <View style={styles.settingDivider} />
            <SettingRow
              icon="speedometer-outline"
              label="Speaking Speed"
              value={speakingSpeed}
              onPress={handleSpeedSelect}
            />
            <View style={styles.settingDivider} />
            <SettingRow
              icon="school-outline"
              label="Correction Intensity"
              value={correctionIntensity}
              onPress={handleCorrectionSelect}
            />
          </View>
        </View>

        {/* Account */}
        <View style={styles.settingSection}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.settingGroup}>
            <SettingRow
              icon="diamond-outline"
              label="Subscription"
              value={isPremium ? 'Premium' : 'Free'}
              iconColor={isPremium ? colors.softOrange : colors.deepTeal}
              onPress={() => router.push('/(tabs)/subscription')}
            />
            <View style={styles.settingDivider} />
            <SettingRow
              icon="language-outline"
              label="Language"
              value="English"
              onPress={() => {}}
            />
            <View style={styles.settingDivider} />
            <SettingRow
              icon="notifications-outline"
              label="Notifications"
              isToggle
              toggleValue={notificationsEnabled}
              onToggle={setNotificationsEnabled}
              showChevron={false}
            />
          </View>
        </View>

        {/* About */}
        <View style={styles.settingSection}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.settingGroup}>
            <SettingRow
              icon="help-circle-outline"
              label="Help & FAQ"
              onPress={() => {}}
            />
            <View style={styles.settingDivider} />
            <SettingRow
              icon="shield-checkmark-outline"
              label="Privacy Policy"
              onPress={() => {}}
            />
            <View style={styles.settingDivider} />
            <SettingRow
              icon="document-text-outline"
              label="Terms of Service"
              onPress={() => {}}
            />
            <View style={styles.settingDivider} />
            <SettingRow
              icon="star-outline"
              label="Rate the App"
              onPress={() => {}}
              iconColor={colors.softOrange}
            />
          </View>
        </View>

        {/* Sign Out */}
        <TouchableOpacity
          style={styles.signOutButton}
          activeOpacity={0.7}
          onPress={handleSignOut}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.errorRed} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>HablaYa v1.0.0</Text>
        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.warmWhite,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  header: {
    marginBottom: spacing.lg,
  },
  headerTitle: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.darkText,
  },
  userCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: spacing.md,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.deepTeal,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
  premiumBadgeSmall: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colors.softOrange,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.darkText,
  },
  userEmail: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  levelBadge: {
    backgroundColor: '#E8F5F3',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  levelBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.deepTeal,
  },
  memberSince: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  settingSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    paddingLeft: spacing.xs,
  },
  settingGroup: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.subtle,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    minHeight: 56,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIconBg: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  settingLabel: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.darkText,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  settingValue: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  settingDivider: {
    height: 1,
    backgroundColor: colors.lightGray,
    marginLeft: 68,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  signOutText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.errorRed,
  },
  versionText: {
    textAlign: 'center',
    fontSize: typography.sizes.xs,
    color: colors.mediumGray,
    marginTop: spacing.md,
  },
});
