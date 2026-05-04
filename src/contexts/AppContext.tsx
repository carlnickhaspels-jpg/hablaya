import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, UserProgress } from '../types';
import * as authApi from '../services/authApi';
import * as analytics from '../services/analytics';

const STORAGE_KEY_ONBOARDED = '@hablaya_is_onboarded';

interface AppContextValue {
  user: User | null;
  userProgress: UserProgress | null;
  isOnboarded: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setUserProgress: (progress: UserProgress | null) => void;
  setIsOnboarded: (value: boolean) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (params: { email: string; name: string; password: string; inviteCode: string }) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [user, setUserState] = useState<User | null>(null);
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null);
  const [isOnboarded, setIsOnboardedState] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load persisted state + verify session on mount
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const onboardedStored = await AsyncStorage.getItem(STORAGE_KEY_ONBOARDED);
        if (!cancelled && onboardedStored === 'true') setIsOnboardedState(true);

        // Try to restore session via stored JWT
        const restored = await authApi.me();
        if (!cancelled && restored) {
          setUserState(restored);
        }
      } catch (error) {
        console.warn('AppContext init failed:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    init();
    return () => { cancelled = true; };
  }, []);

  // Identify the user with analytics whenever they change
  useEffect(() => {
    if (user) {
      analytics.identify(user.id, {
        email: user.email,
        name: user.name,
        level: user.level,
      });
    }
  }, [user?.id, user?.email, user?.name, user?.level]);

  const setUser = useCallback((u: User | null) => {
    setUserState(u);
  }, []);

  const setIsOnboarded = useCallback(async (value: boolean) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_ONBOARDED, value ? 'true' : 'false');
      setIsOnboardedState(value);
    } catch (error) {
      console.warn('Failed to persist onboarded state:', error);
      setIsOnboardedState(value);
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await authApi.signin({ email, password });
    setUserState(result.user);
    analytics.trackSignIn();
  }, []);

  const signUp = useCallback(async (params: { email: string; name: string; password: string; inviteCode: string }) => {
    const result = await authApi.signup(params);
    setUserState(result.user);
    analytics.trackSignUp('email');
  }, []);

  const signOut = useCallback(async () => {
    analytics.trackSignOut();
    await authApi.signout();
    setUserState(null);
    analytics.reset();
    // Reset onboarded state so re-signup is forced through onboarding
    await AsyncStorage.removeItem(STORAGE_KEY_ONBOARDED);
    setIsOnboardedState(false);
  }, []);

  const updateUser = useCallback(async (updates: Partial<User>) => {
    setUserState((prev) => (prev ? { ...prev, ...updates } : prev));
    // Sync to backend (best-effort)
    const apiUpdates: any = {};
    if (updates.level !== undefined) apiUpdates.level = updates.level;
    if (updates.subLevel !== undefined) apiUpdates.subLevel = updates.subLevel;
    if (updates.nativeLanguage !== undefined) apiUpdates.nativeLanguage = updates.nativeLanguage;
    if (updates.targetAccent !== undefined) apiUpdates.targetAccent = updates.targetAccent;
    if (updates.name !== undefined) apiUpdates.name = updates.name;
    if (Object.keys(apiUpdates).length) {
      try { await authApi.updateProfile(apiUpdates); } catch {}
    }
  }, []);

  if (isLoading) {
    return null;
  }

  return (
    <AppContext.Provider
      value={{
        user,
        userProgress,
        isOnboarded,
        isLoading,
        setUser,
        setUserProgress,
        setIsOnboarded,
        signIn,
        signUp,
        signOut,
        updateUser,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
