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

const STORAGE_KEY_ONBOARDED = '@hablaya_is_onboarded';

interface AppContextValue {
  user: User | null;
  userProgress: UserProgress | null;
  isOnboarded: boolean;
  setUser: (user: User | null) => void;
  setUserProgress: (progress: UserProgress | null) => void;
  setIsOnboarded: (value: boolean) => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

const PREVIEW_USER: User = {
  id: 'preview-user',
  email: 'carlos@test.com',
  name: 'Carlos',
  level: 'principiante',
  subLevel: 2,
  nativeLanguage: 'en',
  targetAccent: 'es-MX',
  createdAt: '2025-03-01T00:00:00Z',
  streak: 7,
  totalMinutesSpoken: 142,
  conversationsCompleted: 18,
  isPremium: false,
};

const PREVIEW_PROGRESS: UserProgress = {
  userId: 'preview-user',
  fluencyScore: 34,
  minutesSpokenToday: 12,
  minutesSpokenWeek: 68,
  minutesSpokenTotal: 142,
  currentStreak: 7,
  longestStreak: 12,
  wordsUsed: 237,
  errorsThisWeek: 23,
  level: 'principiante',
  scenariosCompleted: 14,
};

// Set to true to preview the main app screens without signing in
const PREVIEW_MODE = false;

export function AppProvider({ children }: AppProviderProps) {
  const [user, setUser] = useState<User | null>(PREVIEW_MODE ? PREVIEW_USER : null);
  const [userProgress, setUserProgress] = useState<UserProgress | null>(PREVIEW_MODE ? PREVIEW_PROGRESS : null);
  const [isOnboarded, setIsOnboardedState] = useState<boolean>(PREVIEW_MODE ? true : false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadPersistedState = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY_ONBOARDED);
        if (stored === 'true') {
          setIsOnboardedState(true);
        }
      } catch (error) {
        console.warn('Failed to load onboarded state from AsyncStorage:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPersistedState();
  }, []);

  const setIsOnboarded = useCallback(async (value: boolean) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_ONBOARDED, value ? 'true' : 'false');
      setIsOnboardedState(value);
    } catch (error) {
      console.warn('Failed to persist onboarded state to AsyncStorage:', error);
      setIsOnboardedState(value);
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
        setUser,
        setUserProgress,
        setIsOnboarded,
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
