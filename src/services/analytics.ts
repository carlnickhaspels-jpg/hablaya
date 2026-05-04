/**
 * PostHog analytics integration. Web-only (no-op on native).
 *
 * The PostHog write-key is fetched from /api/config so we don't need to bake
 * keys into the bundle. If the server returns no key, every function is a
 * no-op — analytics are simply disabled.
 *
 * Calls made before init resolves are queued and replayed once we know whether
 * PostHog is enabled.
 */

import { Platform } from 'react-native';
import posthog from 'posthog-js';

const isWeb = Platform.OS === 'web';

let initialized = false;
let initPromise: Promise<void> | null = null;
let isEnabled = false;
let pendingCalls: Array<() => void> = [];

interface ClientConfig {
  posthogKey?: string | null;
  posthogHost?: string | null;
}

function ensureInit(): Promise<void> {
  if (!isWeb) return Promise.resolve();
  if (initialized) return Promise.resolve();
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const res = await fetch('/api/config');
      if (!res.ok) return;
      const data = (await res.json()) as ClientConfig;
      if (data.posthogKey) {
        posthog.init(data.posthogKey, {
          api_host: data.posthogHost || 'https://eu.i.posthog.com',
          capture_pageview: false,
          persistence: 'localStorage',
          autocapture: false,
        });
        isEnabled = true;
      }
    } catch {
      // ignore — analytics are best-effort
    } finally {
      initialized = true;
      const queued = pendingCalls;
      pendingCalls = [];
      if (isEnabled) {
        for (const fn of queued) {
          try { fn(); } catch {}
        }
      }
    }
  })();

  return initPromise;
}

function enqueue(fn: () => void) {
  if (!isWeb) return;
  if (initialized) {
    if (isEnabled) {
      try { fn(); } catch {}
    }
    return;
  }
  pendingCalls.push(fn);
  // Kick off init if it hasn't started yet
  ensureInit();
}

// ── Core API ───────────────────────────────────────────────────────────

export function identify(userId: string, traits?: Record<string, unknown>): void {
  enqueue(() => posthog.identify(userId, traits));
}

export function reset(): void {
  if (!isWeb) return;
  if (initialized && isEnabled) {
    try { posthog.reset(); } catch {}
  }
}

export function track(name: string, props?: Record<string, unknown>): void {
  enqueue(() => posthog.capture(name, props));
}

// ── Helper events ──────────────────────────────────────────────────────

export function trackPageView(pageName: string): void {
  track('$pageview', { page: pageName });
}

export function trackSignUp(method: string): void {
  track('signup', { method });
}

export function trackSignIn(): void {
  track('signin');
}

export function trackSignOut(): void {
  track('signout');
}

export function trackConversationStart(scenarioId: string, theme?: string): void {
  track('conversation_started', { scenario_id: scenarioId, theme });
}

export function trackConversationEnd(
  scenarioId: string,
  durationSec: number,
  messageCount: number
): void {
  track('conversation_ended', {
    scenario_id: scenarioId,
    duration_sec: durationSec,
    message_count: messageCount,
  });
}

export function trackUserMessage(scenarioId: string, hasForeignWords: boolean): void {
  track('user_message_sent', {
    scenario_id: scenarioId,
    has_foreign_words: hasForeignWords,
  });
}

export function trackHintRequested(scenarioId: string): void {
  track('hint_requested', { scenario_id: scenarioId });
}

export function trackTranslateUsed(word: string): void {
  track('translate_used', { word });
}

export function trackImproveRequested(): void {
  track('improve_requested');
}

export function trackLevelChanged(newLevel: string): void {
  track('level_changed', { new_level: newLevel });
}

export function trackFeedbackSubmitted(category: string): void {
  track('feedback_submitted', { category });
}

export function trackInstallBannerShown(): void {
  track('install_banner_shown');
}

export function trackInstallBannerDismissed(): void {
  track('install_banner_dismissed');
}
