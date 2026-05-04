/**
 * Banner that prompts the user to install HablaYa as a PWA.
 *
 * - Renders nothing on native or when already installed.
 * - On Android Chrome, hooks into the `beforeinstallprompt` event so the
 *   "Install" button can fire the native install dialog.
 * - On iOS Safari (no native prompt support), shows static instructions to
 *   "Add to Home Screen" via the share sheet.
 * - Once dismissed, hides for 7 days (tracked in localStorage).
 */

import React, { useEffect, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '@/src/constants/theme';
import { trackInstallBannerShown, trackInstallBannerDismissed } from '@/src/services/analytics';

const DISMISS_KEY = '@hablaya_pwa_install_dismissed_at';
const DISMISS_DAYS = 7;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function detectEnvironment() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { isPwa: true, isIOSSafari: false, isAndroidChrome: false };
  }

  const ua = navigator.userAgent || '';
  const standalone =
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;

  const isIOSSafari =
    /iPad|iPhone|iPod/.test(ua) &&
    /Safari/.test(ua) &&
    !/Chrome|FxiOS|CriOS|EdgiOS|OPiOS/.test(ua);

  const isAndroidChrome =
    /Android/.test(ua) && /Chrome/.test(ua) && !/SamsungBrowser|EdgA|OPR/.test(ua);

  return { isPwa: standalone, isIOSSafari, isAndroidChrome };
}

function wasRecentlyDismissed(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    const stored = window.localStorage.getItem(DISMISS_KEY);
    if (!stored) return false;
    const dismissedAt = parseInt(stored, 10);
    if (!Number.isFinite(dismissedAt)) return false;
    const ageMs = Date.now() - dismissedAt;
    return ageMs < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function markDismissed() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(DISMISS_KEY, Date.now().toString());
  } catch {}
}

export default function PwaInstallBanner() {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | null>(null);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const env = detectEnvironment();
    if (env.isPwa) return;
    if (wasRecentlyDismissed()) return;

    if (env.isIOSSafari) {
      setPlatform('ios');
      setVisible(true);
      trackInstallBannerShown();
      return;
    }

    if (env.isAndroidChrome) {
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        setPlatform('android');
        setVisible(true);
        trackInstallBannerShown();
      };
      window.addEventListener('beforeinstallprompt', handler as EventListener);
      return () => {
        window.removeEventListener(
          'beforeinstallprompt',
          handler as EventListener
        );
      };
    }
  }, []);

  if (Platform.OS !== 'web' || !visible || !platform) return null;

  const handleDismiss = () => {
    markDismissed();
    trackInstallBannerDismissed();
    setVisible(false);
  };

  const handleInstallAndroid = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setVisible(false);
      }
    } catch {
      // ignore
    } finally {
      setDeferredPrompt(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="sparkles" size={22} color={colors.deepTeal} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>Install HablaYa for the best experience</Text>
        {platform === 'ios' ? (
          <Text style={styles.subtitle}>
            Tap{' '}
            <Ionicons
              name="share-outline"
              size={14}
              color={colors.textSecondary}
            />
            {' '}then "Add to Home Screen"
          </Text>
        ) : (
          <Text style={styles.subtitle}>
            One tap to add it to your home screen
          </Text>
        )}
      </View>
      {platform === 'android' && deferredPrompt && (
        <TouchableOpacity
          style={styles.installButton}
          onPress={handleInstallAndroid}
          activeOpacity={0.85}
        >
          <Text style={styles.installButtonText}>Install</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={styles.closeButton}
        onPress={handleDismiss}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel="Dismiss install banner"
      >
        <Ionicons name="close" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warmWhite,
    borderLeftWidth: 4,
    borderLeftColor: colors.deepTeal,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: spacing.sm,
    ...shadows.subtle,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.deepTeal + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.darkText,
  },
  subtitle: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    lineHeight: typography.sizes.xs * 1.4,
  },
  installButton: {
    backgroundColor: colors.deepTeal,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
  },
  installButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.white,
  },
  closeButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
