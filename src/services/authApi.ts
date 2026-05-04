/**
 * Real authentication API client. Talks to the Express endpoints
 * (/api/auth/*) backed by Postgres + JWT.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User, FluencyLevel } from '@/src/types';

const TOKEN_KEY = '@hablaya_auth_token';

let cachedToken: string | null = null;

export async function loadStoredToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  try {
    cachedToken = await AsyncStorage.getItem(TOKEN_KEY);
    return cachedToken;
  } catch {
    return null;
  }
}

async function setStoredToken(token: string | null): Promise<void> {
  cachedToken = token;
  try {
    if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
    else await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {}
}

interface RawUser {
  id: string;
  email: string;
  name: string;
  level: string;
  subLevel: number;
  nativeLanguage: string;
  targetAccent: string;
  isPremium: boolean;
  createdAt: string;
}

function adaptUser(raw: RawUser): User {
  return {
    id: raw.id,
    email: raw.email,
    name: raw.name,
    level: raw.level as FluencyLevel,
    subLevel: raw.subLevel,
    nativeLanguage: raw.nativeLanguage,
    targetAccent: raw.targetAccent as User['targetAccent'],
    isPremium: raw.isPremium,
    createdAt: raw.createdAt,
    streak: 0,
    totalMinutesSpoken: 0,
    conversationsCompleted: 0,
  };
}

async function authedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await loadStoredToken();
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
}

export interface AuthResult {
  user: User;
}

export async function signup(params: {
  email: string;
  name: string;
  password: string;
  inviteCode: string;
}): Promise<AuthResult> {
  const res = await authedFetch('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Sign up failed');
  await setStoredToken(data.token);
  return { user: adaptUser(data.user) };
}

export async function signin(params: { email: string; password: string }): Promise<AuthResult> {
  const res = await authedFetch('/api/auth/signin', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Sign in failed');
  await setStoredToken(data.token);
  return { user: adaptUser(data.user) };
}

export async function me(): Promise<User | null> {
  const token = await loadStoredToken();
  if (!token) return null;
  const res = await authedFetch('/api/auth/me');
  if (!res.ok) {
    if (res.status === 401) await setStoredToken(null);
    return null;
  }
  const data = await res.json();
  return adaptUser(data.user);
}

export async function signout(): Promise<void> {
  try { await authedFetch('/api/auth/signout', { method: 'POST' }); } catch {}
  await setStoredToken(null);
}

export async function updateProfile(updates: Partial<{
  level: FluencyLevel;
  subLevel: number;
  nativeLanguage: string;
  targetAccent: string;
  name: string;
}>): Promise<User | null> {
  const res = await authedFetch('/api/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return adaptUser(data.user);
}

export async function submitFeedback(params: {
  category: 'bug' | 'idea' | 'praise' | 'other';
  message: string;
  clientVersion?: string;
}): Promise<void> {
  const res = await authedFetch('/api/feedback', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to send feedback');
  }
}
