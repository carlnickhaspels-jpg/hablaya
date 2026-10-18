import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, typography, spacing, borderRadius, shadows } from '@/src/constants/theme';
import { useApp } from '@/src/contexts/AppContext';
import type { FluencyLevel } from '@/src/types';
import PickerModal, { PickerOption } from '@/src/components/PickerModal';
import ConfirmModal from '@/src/components/ConfirmModal';
import FeedbackModal from '@/src/components/FeedbackModal';
import { CLIENT_VERSION, CLIENT_BUILD_AT } from '@/src/constants/build';
import {
  getPreferences,
  setTutor as saveTutor,
  setCorrection as saveCorrection,
  DEFAULT_TUTOR,
  DEFAULT_CORRECTION,
  type TutorId,
  type CorrectionId,
} from '@/src/services/preferences';

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

const TUTOR_LABELS: Record<TutorId, string> = {
  carlos: 'Carlos (man)',
  maria: 'María (vrouw)',
};

const CORRECTION_LABELS: Record<CorrectionId, string> = {
  all: 'All errors',
  important: 'Important only',
  flow: 'Flow mode',
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
  const { user, setUser, signOut, updateUser } = useApp();
  const router = useRouter();

  // Tutor and correction choice are stored on the device (see preferences.ts)
  const [tutor, setTutor] = useState<TutorId>(DEFAULT_TUTOR);
  const [correction, setCorrection] = useState<CorrectionId>(DEFAULT_CORRECTION);

  React.useEffect(() => {
    let cancelled = false;
    getPreferences().then((prefs) => {
      if (cancelled) return;
      setTutor(prefs.tutor);
      setCorrection(prefs.correction);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Modal state
  const [pickerOpen, setPickerOpen] = useState<null | 'level' | 'voice' | 'correction'>(null);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showNuclearConfirm, setShowNuclearConfirm] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  // Version check — detects if user has a stale cached app
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const [versionState, setVersionState] = useState<'checking' | 'up-to-date' | 'outdated' | 'unknown'>('checking');

  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/version', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setServerVersion(data.deployedAt || data.startedAt || null);
        const serverTime = new Date(data.startedAt || data.deployedAt || 0).getTime();
        const clientTime = new Date(CLIENT_BUILD_AT).getTime();
        // If server is significantly newer than client (>1 min), client is stale
        if (serverTime > clientTime + 60_000) {
          setVersionState('outdated');
        } else {
          setVersionState('up-to-date');
        }
      })
      .catch(() => {
        if (!cancelled) setVersionState('unknown');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleHardRefresh = async () => {
    if (typeof window === 'undefined') return;

    // 1. Try to unregister any service workers (PWAs sometimes have them)
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch {}

    // 2. Try to delete all caches (Cache Storage API)
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {}

    // 3. Navigate to a cache-busted URL using replace() so the old URL
    // can't be served from history cache either.
    const url = new URL(window.location.href);
    url.searchParams.set('_t', Date.now().toString());
    url.hash = '';
    window.location.replace(url.toString());
  };

  const handleNuclearReset = async () => {
    if (typeof window === 'undefined') return;

    // Wipe everything: localStorage, sessionStorage, IndexedDB, caches, SW
    try { window.localStorage.clear(); } catch {}
    try { window.sessionStorage.clear(); } catch {}

    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch {}

    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {}

    try {
      if ('indexedDB' in window && (indexedDB as any).databases) {
        const dbs = await (indexedDB as any).databases();
        for (const db of dbs) {
          if (db.name) indexedDB.deleteDatabase(db.name);
        }
      }
    } catch {}

    const url = new URL(window.location.origin + '/');
    url.searchParams.set('_t', Date.now().toString());
    window.location.replace(url.toString());
  };

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

  const updateLevel = (newLevel: FluencyLevel) => {
    if (!user) return;
    updateUser({ level: newLevel });
  };

  const confirmSignOut = async () => {
    setShowSignOutConfirm(false);
    await signOut();
    router.replace('/(auth)/welcome');
  };

  // Picker option lists
  const levelOptions: PickerOption[] = [
    { key: 'silencioso', label: LEVEL_DISPLAY.silencioso, description: LEVEL_DESCRIPTIONS.silencioso },
    { key: 'principiante', label: LEVEL_DISPLAY.principiante, description: LEVEL_DESCRIPTIONS.principiante },
    { key: 'conversador', label: LEVEL_DISPLAY.conversador, description: LEVEL_DESCRIPTIONS.conversador },
    { key: 'fluido', label: LEVEL_DISPLAY.fluido, description: LEVEL_DESCRIPTIONS.fluido },
    { key: 'nativo', label: LEVEL_DISPLAY.nativo, description: LEVEL_DESCRIPTIONS.nativo },
  ];

  const voiceOptions: PickerOption[] = [
    { key: 'carlos', label: TUTOR_LABELS.carlos },
    { key: 'maria', label: TUTOR_LABELS.maria },
  ];

  const correctionOptions: PickerOption[] = [
    { key: 'all', label: CORRECTION_LABELS.all, description: 'Correct every mistake' },
    { key: 'important', label: CORRECTION_LABELS.important, description: 'Only meaningful corrections' },
    { key: 'flow', label: CORRECTION_LABELS.flow, description: 'Minimal interruptions' },
  ];

  const handlePickerSelect = (key: string) => {
    if (pickerOpen === 'level') updateLevel(key as FluencyLevel);
    else if (pickerOpen === 'voice') {
      setTutor(key as TutorId);
      saveTutor(key as TutorId);
    } else if (pickerOpen === 'correction') {
      setCorrection(key as CorrectionId);
      saveCorrection(key as CorrectionId);
    }
    setPickerOpen(null);
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
              onPress={() => setPickerOpen('level')}
              iconColor={colors.softOrange}
            />
            <View style={styles.settingDivider} />
            <SettingRow
              icon="refresh-outline"
              label="Change Level"
              onPress={() => setPickerOpen('level')}
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
              value={TUTOR_LABELS[tutor]}
              onPress={() => setPickerOpen('voice')}
            />
            <View style={styles.settingDivider} />
            <SettingRow
              icon="school-outline"
              label="Correction Intensity"
              value={CORRECTION_LABELS[correction]}
              onPress={() => setPickerOpen('correction')}
            />
          </View>
        </View>

        {/* About */}
        <View style={styles.settingSection}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.settingGroup}>
            <SettingRow
              icon="chatbox-ellipses-outline"
              label="Send Feedback"
              onPress={() => setShowFeedback(true)}
              iconColor={colors.deepTeal}
            />
            <View style={styles.settingDivider} />
            <SettingRow
              icon="refresh-circle-outline"
              label="Force Update Now"
              onPress={handleHardRefresh}
              iconColor={colors.deepTeal}
            />
            <View style={styles.settingDivider} />
            <SettingRow
              icon="trash-outline"
              label="Clear All Cached Data"
              onPress={() => setShowNuclearConfirm(true)}
              iconColor={colors.errorRed}
            />
          </View>
        </View>

        {/* Sign Out */}
        <TouchableOpacity
          style={styles.signOutButton}
          activeOpacity={0.7}
          onPress={() => setShowSignOutConfirm(true)}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.errorRed} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>
            HablaYa v{CLIENT_VERSION}
          </Text>
          <Text style={styles.versionSubtext}>
            Built {new Date(CLIENT_BUILD_AT).toLocaleString('nl-NL', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
          {versionState === 'outdated' && (
            <TouchableOpacity
              style={styles.updateBanner}
              onPress={handleHardRefresh}
              activeOpacity={0.85}
            >
              <Ionicons name="refresh-circle" size={20} color={colors.softOrange} />
              <View style={{ flex: 1 }}>
                <Text style={styles.updateBannerTitle}>Update available</Text>
                <Text style={styles.updateBannerText}>
                  Tap to reload — your version is older than the server
                </Text>
              </View>
            </TouchableOpacity>
          )}
          {versionState === 'up-to-date' && (
            <View style={styles.versionUpToDate}>
              <Ionicons name="checkmark-circle" size={14} color={colors.successGreen} />
              <Text style={styles.versionUpToDateText}>Up to date</Text>
            </View>
          )}
        </View>
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Picker modals */}
      <PickerModal
        visible={pickerOpen === 'level'}
        title="Spanish Level"
        message="Pick the level that matches your current Spanish ability. Your tutor will adjust the difficulty."
        options={levelOptions}
        selectedKey={userLevel}
        onSelect={handlePickerSelect}
        onCancel={() => setPickerOpen(null)}
      />
      <PickerModal
        visible={pickerOpen === 'voice'}
        title="Tutor Voice"
        message="Choose how your AI tutor sounds."
        options={voiceOptions}
        selectedKey={tutor}
        onSelect={handlePickerSelect}
        onCancel={() => setPickerOpen(null)}
      />
      <PickerModal
        visible={pickerOpen === 'correction'}
        title="Correction Intensity"
        message="How often should the tutor correct your Spanish?"
        options={correctionOptions}
        selectedKey={correction}
        onSelect={handlePickerSelect}
        onCancel={() => setPickerOpen(null)}
      />

      {/* Confirm modals */}
      <ConfirmModal
        visible={showSignOutConfirm}
        title="Sign Out"
        message="Are you sure you want to sign out of HablaYa?"
        confirmText="Sign Out"
        destructive
        onConfirm={confirmSignOut}
        onCancel={() => setShowSignOutConfirm(false)}
      />

      <ConfirmModal
        visible={showNuclearConfirm}
        title="Clear All Cached Data"
        message="This wipes all cached files, service workers, and stored data, then forces a fresh download from the server. Use this if your app feels stuck on an old version. You'll need to sign in again."
        confirmText="Clear Everything"
        destructive
        onConfirm={() => {
          setShowNuclearConfirm(false);
          handleNuclearReset();
        }}
        onCancel={() => setShowNuclearConfirm(false)}
      />

      <FeedbackModal
        visible={showFeedback}
        onClose={() => setShowFeedback(false)}
      />
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
  versionContainer: {
    alignItems: 'center',
    marginTop: spacing.md,
    gap: 2,
  },
  versionText: {
    textAlign: 'center',
    fontSize: typography.sizes.xs,
    color: colors.mediumGray,
  },
  versionSubtext: {
    textAlign: 'center',
    fontSize: typography.sizes.xs,
    color: colors.mediumGray,
  },
  versionUpToDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
  },
  versionUpToDateText: {
    fontSize: typography.sizes.xs,
    color: colors.successGreen,
    fontWeight: typography.weights.medium,
  },
  updateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.softOrange + '15',
    borderWidth: 1,
    borderColor: colors.softOrange + '40',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginTop: spacing.md,
    marginHorizontal: spacing.md,
    alignSelf: 'stretch',
  },
  updateBannerTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.softOrange,
  },
  updateBannerText: {
    fontSize: typography.sizes.xs,
    color: colors.darkText,
  },
});
