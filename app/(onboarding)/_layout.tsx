import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="level-select" />
      <Stack.Screen name="assessment" />
      <Stack.Screen name="results" />
    </Stack>
  );
}
