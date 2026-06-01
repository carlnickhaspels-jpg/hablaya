import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppProvider, useApp } from '@/src/contexts/AppContext';
import { colors } from '@/src/constants/theme';
import PwaInstallBanner from '@/src/components/PwaInstallBanner';
import { trackPageView } from '@/src/services/analytics';

function RootLayoutNav() {
  const { user, isOnboarded } = useApp();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const inAuthGroup = segments[0] === '(auth)';
    const inOnboardingGroup = segments[0] === '(onboarding)';
    // Password-reset and forgot-password must stay accessible even to logged-in
    // users — they may be following an email link or proactively changing
    // their password. Don't auto-redirect away from these.
    const segmentStrings = segments as string[];
    const onPasswordResetFlow =
      segmentStrings.includes('reset-password') ||
      segmentStrings.includes('forgot-password');

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/welcome');
    } else if (user && !isOnboarded && !inOnboardingGroup && !onPasswordResetFlow) {
      router.replace('/(onboarding)/level-select');
    } else if (
      user &&
      isOnboarded &&
      (inAuthGroup || inOnboardingGroup) &&
      !onPasswordResetFlow
    ) {
      router.replace('/(tabs)');
    }
  }, [user, isOnboarded, segments]);

  // Fire a pageview each time the route changes
  useEffect(() => {
    const path = '/' + segments.join('/');
    trackPageView(path);
  }, [segments]);

  return (
    <View style={layoutStyles.root}>
      <StatusBar style="dark" />
      <PwaInstallBanner />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="conversation/[id]"
          options={{
            presentation: 'fullScreenModal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="conversation/summary"
          options={{
            presentation: 'card',
            animation: 'slide_from_right',
          }}
        />
      </Stack>
    </View>
  );
}

const layoutStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.warmWhite,
  },
});

export default function RootLayout() {
  return (
    <AppProvider>
      <RootLayoutNav />
    </AppProvider>
  );
}
