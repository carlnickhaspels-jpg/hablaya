export type FluencyLevel =
  | 'silencioso'
  | 'principiante'
  | 'conversador'
  | 'fluido'
  | 'nativo';

export type TargetAccent = 'es-MX' | 'es-ES';

export type ConversationMode = 'scenario' | 'free-talk' | 'role-play' | 'challenge';

export type MessageRole = 'user' | 'tutor';

export type CorrectionType = 'grammar' | 'vocabulary' | 'pronunciation';

export type CorrectionSeverity = 'minor' | 'moderate' | 'important';

export type ScenarioTheme = 'travel' | 'social' | 'daily-life' | 'work';

export interface User {
  id: string;
  email: string;
  name: string;
  level: FluencyLevel;
  subLevel: number;
  nativeLanguage: string;
  targetAccent: TargetAccent;
  createdAt: string;
  streak: number;
  totalMinutesSpoken: number;
  conversationsCompleted: number;
  isPremium: boolean;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  audioUrl?: string;
  timestamp: string;
  pronunciationScore?: number;
}

export interface Correction {
  id: string;
  messageId: string;
  type: CorrectionType;
  original: string;
  corrected: string;
  explanation: string;
  severity: CorrectionSeverity;
}

export interface Conversation {
  id: string;
  userId: string;
  scenarioId?: string;
  mode: ConversationMode;
  startedAt: string;
  endedAt?: string;
  messages: Message[];
  corrections: Correction[];
  pronunciationScore?: number;
  summary?: string;
}

export interface Scenario {
  id: string;
  title: string;
  titleEs: string;
  description: string;
  theme: ScenarioTheme;
  difficulty: 1 | 2 | 3 | 4 | 5;
  estimatedMinutes: number;
  context: string;
  starterPrompt: string;
  tags: string[];
}

export interface UserProgress {
  userId: string;
  fluencyScore: number;
  minutesSpokenToday: number;
  minutesSpokenWeek: number;
  minutesSpokenTotal: number;
  currentStreak: number;
  longestStreak: number;
  wordsUsed: number;
  errorsThisWeek: number;
  level: FluencyLevel;
  scenariosCompleted: number;
}

export interface SessionSummary {
  conversationId: string;
  duration: number;
  pronunciationScore: number;
  correctionsCount: number;
  wordsSpoken: number;
  newWordsUsed: number;
  highlights: string[];
}
