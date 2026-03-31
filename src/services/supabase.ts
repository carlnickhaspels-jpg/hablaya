import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { Conversation, Message, Correction, UserProgress, User } from '../types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SUPABASE SQL SCHEMA
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Run this SQL in the Supabase SQL Editor to create the required tables:
 *
 * ```sql
 * -- Enable UUID generation
 * CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
 *
 * -- Users table (extends Supabase Auth)
 * CREATE TABLE public.users (
 *   id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 *   email TEXT NOT NULL,
 *   name TEXT NOT NULL DEFAULT '',
 *   level TEXT NOT NULL DEFAULT 'principiante'
 *     CHECK (level IN ('silencioso','principiante','conversador','fluido','nativo')),
 *   sub_level INTEGER NOT NULL DEFAULT 1,
 *   native_language TEXT NOT NULL DEFAULT 'en',
 *   target_accent TEXT NOT NULL DEFAULT 'es-MX'
 *     CHECK (target_accent IN ('es-MX','es-ES')),
 *   streak INTEGER NOT NULL DEFAULT 0,
 *   total_minutes_spoken NUMERIC NOT NULL DEFAULT 0,
 *   conversations_completed INTEGER NOT NULL DEFAULT 0,
 *   is_premium BOOLEAN NOT NULL DEFAULT FALSE,
 *   created_at TIMESTAMPTZ NOT NULL DEFAULT now()
 * );
 *
 * -- Conversations table
 * CREATE TABLE public.conversations (
 *   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *   user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 *   scenario_id TEXT,
 *   mode TEXT NOT NULL DEFAULT 'free-talk'
 *     CHECK (mode IN ('scenario','free-talk','role-play','challenge')),
 *   started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 *   ended_at TIMESTAMPTZ,
 *   pronunciation_score NUMERIC,
 *   summary TEXT,
 *   created_at TIMESTAMPTZ NOT NULL DEFAULT now()
 * );
 *
 * -- Messages table
 * CREATE TABLE public.messages (
 *   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *   conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
 *   role TEXT NOT NULL CHECK (role IN ('user','tutor')),
 *   content TEXT NOT NULL,
 *   audio_url TEXT,
 *   pronunciation_score NUMERIC,
 *   timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
 * );
 *
 * -- Corrections table
 * CREATE TABLE public.corrections (
 *   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *   message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
 *   type TEXT NOT NULL CHECK (type IN ('grammar','vocabulary','pronunciation')),
 *   original TEXT NOT NULL,
 *   corrected TEXT NOT NULL,
 *   explanation TEXT NOT NULL,
 *   severity TEXT NOT NULL DEFAULT 'moderate'
 *     CHECK (severity IN ('minor','moderate','important')),
 *   created_at TIMESTAMPTZ NOT NULL DEFAULT now()
 * );
 *
 * -- User progress table
 * CREATE TABLE public.user_progress (
 *   user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
 *   fluency_score NUMERIC NOT NULL DEFAULT 0,
 *   minutes_spoken_today NUMERIC NOT NULL DEFAULT 0,
 *   minutes_spoken_week NUMERIC NOT NULL DEFAULT 0,
 *   minutes_spoken_total NUMERIC NOT NULL DEFAULT 0,
 *   current_streak INTEGER NOT NULL DEFAULT 0,
 *   longest_streak INTEGER NOT NULL DEFAULT 0,
 *   words_used INTEGER NOT NULL DEFAULT 0,
 *   errors_this_week INTEGER NOT NULL DEFAULT 0,
 *   level TEXT NOT NULL DEFAULT 'principiante',
 *   scenarios_completed INTEGER NOT NULL DEFAULT 0,
 *   updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
 * );
 *
 * -- Enable Row Level Security
 * ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE public.corrections ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
 *
 * -- RLS Policies: users can only access their own data
 * CREATE POLICY "Users can read own data" ON public.users
 *   FOR SELECT USING (auth.uid() = id);
 * CREATE POLICY "Users can update own data" ON public.users
 *   FOR UPDATE USING (auth.uid() = id);
 *
 * CREATE POLICY "Users can CRUD own conversations" ON public.conversations
 *   FOR ALL USING (auth.uid() = user_id);
 *
 * CREATE POLICY "Users can CRUD own messages" ON public.messages
 *   FOR ALL USING (
 *     conversation_id IN (
 *       SELECT id FROM public.conversations WHERE user_id = auth.uid()
 *     )
 *   );
 *
 * CREATE POLICY "Users can CRUD own corrections" ON public.corrections
 *   FOR ALL USING (
 *     message_id IN (
 *       SELECT m.id FROM public.messages m
 *       JOIN public.conversations c ON c.id = m.conversation_id
 *       WHERE c.user_id = auth.uid()
 *     )
 *   );
 *
 * CREATE POLICY "Users can CRUD own progress" ON public.user_progress
 *   FOR ALL USING (auth.uid() = user_id);
 *
 * -- Indexes for performance
 * CREATE INDEX idx_conversations_user_id ON public.conversations(user_id);
 * CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);
 * CREATE INDEX idx_corrections_message_id ON public.corrections(message_id);
 * ```
 * ─────────────────────────────────────────────────────────────────────────────
 */

const supabaseUrl =
  Constants.expoConfig?.extra?.SUPABASE_URL ??
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  '';

const supabaseAnonKey =
  Constants.expoConfig?.extra?.SUPABASE_ANON_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  '';

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export async function signIn(
  email: string,
  password: string
): Promise<{ user: User | null; error: string | null }> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { user: null, error: error.message };
    if (!data.user) return { user: null, error: 'No user returned' };

    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    return {
      user: profile
        ? {
            id: profile.id,
            email: profile.email,
            name: profile.name,
            level: profile.level,
            subLevel: profile.sub_level,
            nativeLanguage: profile.native_language,
            targetAccent: profile.target_accent,
            createdAt: profile.created_at,
            streak: profile.streak,
            totalMinutesSpoken: profile.total_minutes_spoken,
            conversationsCompleted: profile.conversations_completed,
            isPremium: profile.is_premium,
          }
        : null,
      error: null,
    };
  } catch (err) {
    return { user: null, error: 'An unexpected error occurred' };
  }
}

export async function signUp(
  email: string,
  password: string,
  name: string
): Promise<{ user: User | null; error: string | null }> {
  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { user: null, error: error.message };
    if (!data.user) return { user: null, error: 'No user returned' };

    const newUser = {
      id: data.user.id,
      email,
      name,
      level: 'principiante',
      sub_level: 1,
      native_language: 'en',
      target_accent: 'es-MX',
    };

    const { error: insertError } = await supabase.from('users').insert(newUser);
    if (insertError) return { user: null, error: insertError.message };

    return {
      user: {
        id: data.user.id,
        email,
        name,
        level: 'principiante',
        subLevel: 1,
        nativeLanguage: 'en',
        targetAccent: 'es-MX',
        createdAt: new Date().toISOString(),
        streak: 0,
        totalMinutesSpoken: 0,
        conversationsCompleted: 0,
        isPremium: false,
      },
      error: null,
    };
  } catch (err) {
    return { user: null, error: 'An unexpected error occurred' };
  }
}

export async function signOut(): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signOut();
  return { error: error?.message ?? null };
}

export async function getUser(): Promise<{ user: User | null; error: string | null }> {
  try {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) return { user: null, error: null };

    const { data: profile, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (error || !profile) return { user: null, error: error?.message ?? 'Profile not found' };

    return {
      user: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        level: profile.level,
        subLevel: profile.sub_level,
        nativeLanguage: profile.native_language,
        targetAccent: profile.target_accent,
        createdAt: profile.created_at,
        streak: profile.streak,
        totalMinutesSpoken: profile.total_minutes_spoken,
        conversationsCompleted: profile.conversations_completed,
        isPremium: profile.is_premium,
      },
      error: null,
    };
  } catch (err) {
    return { user: null, error: 'An unexpected error occurred' };
  }
}

export async function saveConversation(
  conversation: Conversation
): Promise<{ error: string | null }> {
  try {
    const { error: convError } = await supabase.from('conversations').insert({
      id: conversation.id,
      user_id: conversation.userId,
      scenario_id: conversation.scenarioId ?? null,
      mode: conversation.mode,
      started_at: conversation.startedAt,
      ended_at: conversation.endedAt ?? null,
      pronunciation_score: conversation.pronunciationScore ?? null,
      summary: conversation.summary ?? null,
    });
    if (convError) return { error: convError.message };

    if (conversation.messages.length > 0) {
      const messageRows = conversation.messages.map((m) => ({
        id: m.id,
        conversation_id: conversation.id,
        role: m.role,
        content: m.content,
        audio_url: m.audioUrl ?? null,
        pronunciation_score: m.pronunciationScore ?? null,
        timestamp: m.timestamp,
      }));
      const { error: msgError } = await supabase.from('messages').insert(messageRows);
      if (msgError) return { error: msgError.message };
    }

    if (conversation.corrections.length > 0) {
      const correctionRows = conversation.corrections.map((c) => ({
        id: c.id,
        message_id: c.messageId,
        type: c.type,
        original: c.original,
        corrected: c.corrected,
        explanation: c.explanation,
        severity: c.severity,
      }));
      const { error: corrError } = await supabase.from('corrections').insert(correctionRows);
      if (corrError) return { error: corrError.message };
    }

    return { error: null };
  } catch (err) {
    return { error: 'Failed to save conversation' };
  }
}

export async function getConversations(
  userId: string
): Promise<{ conversations: Conversation[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false });

    if (error) return { conversations: [], error: error.message };

    const conversations: Conversation[] = (data ?? []).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      scenarioId: row.scenario_id,
      mode: row.mode,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      messages: [],
      corrections: [],
      pronunciationScore: row.pronunciation_score,
      summary: row.summary,
    }));

    return { conversations, error: null };
  } catch (err) {
    return { conversations: [], error: 'Failed to fetch conversations' };
  }
}

export async function updateUserProgress(
  progress: UserProgress
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.from('user_progress').upsert({
      user_id: progress.userId,
      fluency_score: progress.fluencyScore,
      minutes_spoken_today: progress.minutesSpokenToday,
      minutes_spoken_week: progress.minutesSpokenWeek,
      minutes_spoken_total: progress.minutesSpokenTotal,
      current_streak: progress.currentStreak,
      longest_streak: progress.longestStreak,
      words_used: progress.wordsUsed,
      errors_this_week: progress.errorsThisWeek,
      level: progress.level,
      scenarios_completed: progress.scenariosCompleted,
      updated_at: new Date().toISOString(),
    });

    return { error: error?.message ?? null };
  } catch (err) {
    return { error: 'Failed to update progress' };
  }
}
