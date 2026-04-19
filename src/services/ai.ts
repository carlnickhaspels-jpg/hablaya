import { Message, Correction, Scenario, CorrectionType, CorrectionSeverity } from '../types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * FUTURE CLAUDE API INTEGRATION
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Replace the mock functions below with real API calls to Anthropic's Claude.
 *
 * Example integration:
 *
 * ```ts
 * import Anthropic from '@anthropic-ai/sdk';
 *
 * const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
 *
 * const TUTOR_SYSTEM_PROMPT = `
 * You are HablaYa, a warm and encouraging Spanish-speaking tutor.
 * Your role is to have natural conversations in Spanish with the user,
 * gently correcting their mistakes while keeping the conversation flowing.
 *
 * RULES:
 * - Speak primarily in Spanish, adjusting complexity to the user's level.
 * - When the user makes a grammar, vocabulary, or pronunciation error,
 *   note it but do NOT break the conversation flow.
 * - Respond naturally first, then provide corrections separately.
 * - Use the scenario context to stay in character.
 * - Be encouraging and celebrate progress.
 * - Keep responses concise (2-4 sentences max).
 *
 * Return your response as JSON:
 * {
 *   "response": "Your Spanish conversational reply",
 *   "corrections": [
 *     {
 *       "type": "grammar" | "vocabulary" | "pronunciation",
 *       "original": "what the user said wrong",
 *       "corrected": "the correct form",
 *       "explanation": "brief, friendly explanation in English",
 *       "severity": "minor" | "moderate" | "important"
 *     }
 *   ]
 * }
 * `;
 *
 * async function callClaude(
 *   messages: Message[],
 *   scenario?: Scenario,
 *   userLevel?: string
 * ) {
 *   const systemPrompt = scenario
 *     ? `${TUTOR_SYSTEM_PROMPT}\n\nSCENARIO: ${scenario.context}\nUSER LEVEL: ${userLevel ?? 'principiante'}`
 *     : `${TUTOR_SYSTEM_PROMPT}\nUSER LEVEL: ${userLevel ?? 'principiante'}`;
 *
 *   const response = await client.messages.create({
 *     model: 'claude-sonnet-4-20250514',
 *     max_tokens: 512,
 *     system: systemPrompt,
 *     messages: messages.map((m) => ({
 *       role: m.role === 'tutor' ? 'assistant' : 'user',
 *       content: m.content,
 *     })),
 *   });
 *
 *   const text = response.content[0].type === 'text' ? response.content[0].text : '';
 *   return JSON.parse(text);
 * }
 * ```
 * ─────────────────────────────────────────────────────────────────────────────
 */

let correctionCounter = 0;

const tutorResponses: string[] = [
  '¡Muy bien! Tu español está mejorando mucho. Cuéntame más sobre eso.',
  'Interesante. ¿Y qué más puedes decirme? Me encanta escucharte.',
  '¡Qué bueno! Eso suena muy divertido. ¿Lo haces seguido?',
  'Entiendo perfectamente. ¿Puedes explicarme un poco más sobre eso?',
  '¡Excelente! Me gusta cómo lo dices. ¿Y después qué pasó?',
  'Ah, ¡qué interesante! Yo también pienso lo mismo. ¿Qué opinas de...?',
  '¡Genial! Tu pronunciación está sonando muy natural. Sigamos practicando.',
  'Muy bien dicho. ¿Has tenido alguna otra experiencia parecida?',
  '¡Perfecto! Eso es exactamente cómo lo diría un hablante nativo.',
  'Me encanta tu entusiasmo. ¿Quieres que practiquemos algo más difícil?',
  '¡Claro que sí! Eso tiene mucho sentido. ¿Y tú qué preferirías?',
  'Buena respuesta. Veo que has estado practicando. ¿Qué más te gustaría saber?',
  '¡Fantástico! Estás usando el vocabulario muy bien. Continuemos.',
  'Sí, exacto. Así se dice. ¿Te gustaría intentar con otra frase?',
  'Muy interesante lo que me cuentas. ¿Desde cuándo te interesa eso?',
  '¡Qué bien! Tu confianza ha crecido mucho. ¿Listo para el siguiente tema?',
  'Eso está muy bien. Solo un pequeño detalle que puedes mejorar, pero en general, excelente.',
  '¡Wow! Esa fue una oración muy completa. Sigue así.',
];

const scenarioResponses: Record<string, string[]> = {
  travel: [
    '¿Es su primera vez aquí? ¡Le va a encantar! ¿Cuántos días se queda?',
    'Le recomiendo visitar el centro histórico. Es muy bonito, especialmente por la noche.',
    '¿Necesita algo más? Estoy aquí para ayudarle.',
    'El precio es muy razonable. ¿Le gustaría ver otras opciones?',
    '¿De dónde viene usted? Recibimos muchos visitantes de todas partes.',
  ],
  social: [
    '¡Qué padre! A mí también me gusta mucho eso. ¿Cuándo empezaste?',
    'Oye, deberíamos juntarnos un día de estos. ¿Qué dices?',
    '¡No manches! Eso está increíble. Cuéntame más.',
    '¿En serio? Yo siempre he querido intentar eso. ¿Es difícil?',
    'Me caes muy bien. Es chido poder platicar así en español.',
  ],
  'daily-life': [
    'Bueno, lo importante es que ya estás aquí. ¿Qué necesitas hoy?',
    'Déjame ver... sí, tenemos exactamente lo que buscas.',
    '¿Algo más en lo que te pueda ayudar? No dudes en preguntar.',
    'Eso es muy común. No te preocupes, todos pasamos por lo mismo.',
    'Te entiendo perfectamente. Vamos a resolver esto juntos.',
  ],
  work: [
    'Me parece una excelente idea. ¿Podría explicar los detalles del proyecto?',
    'Muy profesional. ¿Cuál sería el siguiente paso en su opinión?',
    'Entiendo su punto de vista. ¿Ha considerado también esta alternativa?',
    'Eso demuestra mucha iniciativa. La empresa necesita gente como usted.',
    'Perfecto. Vamos a agendar una reunión para discutir los próximos pasos.',
  ],
};

const correctionTemplates: Array<{
  type: CorrectionType;
  original: string;
  corrected: string;
  explanation: string;
  severity: CorrectionSeverity;
}> = [
  {
    type: 'grammar',
    original: 'Yo soy tengo hambre',
    corrected: 'Yo tengo hambre',
    explanation:
      'You don\'t need "soy" here. "Tener" (to have) is used for hunger in Spanish, not "ser" (to be).',
    severity: 'moderate',
  },
  {
    type: 'grammar',
    original: 'Yo gusto la comida',
    corrected: 'Me gusta la comida',
    explanation:
      '"Gustar" works differently than "to like" in English. The subject is the thing you like, and you use an indirect object pronoun (me, te, le).',
    severity: 'important',
  },
  {
    type: 'vocabulary',
    original: 'Estoy excitado',
    corrected: 'Estoy emocionado',
    explanation:
      '"Excitado" is a false friend! It has a sexual connotation in Spanish. Use "emocionado" for "excited".',
    severity: 'important',
  },
  {
    type: 'pronunciation',
    original: 'gracias (gra-SEE-as)',
    corrected: 'gracias (GRA-thias / GRA-sias)',
    explanation:
      'The stress falls on the first syllable. Also, "ci" makes a soft "s" sound in Latin America or a "th" sound in Spain.',
    severity: 'minor',
  },
  {
    type: 'grammar',
    original: 'Yo estoy bien, y tu?',
    corrected: 'Yo estoy bien, ¿y tú?',
    explanation:
      'Don\'t forget the accent on "tú" (you). Without the accent, "tu" means "your". Also, questions in Spanish use inverted question marks ¿...?',
    severity: 'minor',
  },
  {
    type: 'vocabulary',
    original: 'La librería tiene muchos libros',
    corrected: 'La biblioteca tiene muchos libros',
    explanation:
      '"Librería" means bookstore, not library! "Biblioteca" is the word for library.',
    severity: 'moderate',
  },
  {
    type: 'grammar',
    original: 'Ayer yo como en un restaurante',
    corrected: 'Ayer yo comí en un restaurante',
    explanation:
      'When talking about the past (yesterday), use the preterite tense: "comí" instead of the present "como".',
    severity: 'important',
  },
  {
    type: 'pronunciation',
    original: 'pero (PEH-ro)',
    corrected: 'pero (PEH-rroh)',
    explanation:
      'The Spanish "r" between vowels is a soft tap, like the "tt" in the American English "butter". Keep it light!',
    severity: 'minor',
  },
  {
    type: 'grammar',
    original: 'Es más mejor',
    corrected: 'Es mejor',
    explanation:
      '"Mejor" already means "better" and is the comparative form. You don\'t need "más" in front of it.',
    severity: 'moderate',
  },
  {
    type: 'vocabulary',
    original: 'Estoy embarazada',
    corrected: 'Estoy avergonzado/a',
    explanation:
      'Another famous false friend! "Embarazada" means pregnant, not embarrassed. Use "avergonzado/a" for embarrassed.',
    severity: 'important',
  },
  {
    type: 'grammar',
    original: 'Necesito para estudiar',
    corrected: 'Necesito estudiar',
    explanation:
      'Unlike English "need to", the Spanish "necesitar" is followed directly by the infinitive without "para".',
    severity: 'moderate',
  },
  {
    type: 'pronunciation',
    original: 'hola (HO-la)',
    corrected: 'hola (O-la)',
    explanation:
      'The "h" is always silent in Spanish! Just start with the vowel sound.',
    severity: 'minor',
  },
  {
    type: 'grammar',
    original: 'Yo soy caliente',
    corrected: 'Yo tengo calor',
    explanation:
      '"Soy caliente" has an unintended meaning in Spanish. To say you\'re hot (temperature), use "tengo calor" (I have heat).',
    severity: 'important',
  },
  {
    type: 'vocabulary',
    original: 'Voy a introducir mi amigo',
    corrected: 'Voy a presentar a mi amigo',
    explanation:
      '"Introducir" means to insert or put inside. To introduce a person, use "presentar".',
    severity: 'moderate',
  },
  {
    type: 'grammar',
    original: 'Me gusta los tacos',
    corrected: 'Me gustan los tacos',
    explanation:
      'Since "los tacos" is plural, the verb must also be plural: "gustan" not "gusta".',
    severity: 'moderate',
  },
];

const pronunciationFeedbacks: Array<{ feedback: string; minScore: number; maxScore: number }> = [
  {
    feedback: 'Your vowel sounds are very clear. Keep maintaining those crisp Spanish vowels.',
    minScore: 85,
    maxScore: 95,
  },
  {
    feedback: 'Nice job with the rolled "r" sounds! They are sounding much more natural.',
    minScore: 80,
    maxScore: 95,
  },
  {
    feedback: 'Try to make the "d" between vowels softer, almost like the English "th" in "the".',
    minScore: 65,
    maxScore: 80,
  },
  {
    feedback: 'Watch the stress patterns. Spanish words usually stress the second-to-last syllable unless there is an accent mark.',
    minScore: 60,
    maxScore: 78,
  },
  {
    feedback: 'Your intonation is improving. Try to let sentences flow more naturally without pausing between each word.',
    minScore: 70,
    maxScore: 85,
  },
  {
    feedback: 'Good effort! Focus on the "ñ" sound — it should be like "ny" in "canyon".',
    minScore: 60,
    maxScore: 75,
  },
  {
    feedback: 'Excellent rhythm! You are matching the syllable-timed pattern of Spanish very well.',
    minScore: 85,
    maxScore: 95,
  },
  {
    feedback: 'Remember that "j" and "g" before "e/i" make a throaty sound, like a strong "h".',
    minScore: 65,
    maxScore: 80,
  },
];

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getInitialGreeting(scenario?: Scenario): string {
  if (scenario) {
    return scenario.starterPrompt;
  }
  return '¡Hola! Estoy aquí para practicar español contigo. Podemos hablar de lo que quieras. ¿Qué te gustaría platicar hoy?';
}

export async function generateTutorResponse(
  messages: Message[],
  scenario?: Scenario,
  userLevel?: string,
  meta?: { uncertainSegments?: string[]; detectedLanguage?: string }
): Promise<{ response: string; corrections: Correction[] }> {
  // Try the real AI tutor endpoint first
  try {
    const apiResponse = await fetch('/api/tutor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        scenario: scenario
          ? {
              title: scenario.title,
              titleEs: scenario.titleEs,
              context: scenario.context,
              theme: scenario.theme,
            }
          : null,
        userLevel: userLevel ?? 'principiante',
        uncertainSegments: meta?.uncertainSegments ?? [],
        detectedLanguage: meta?.detectedLanguage,
      }),
    });

    if (apiResponse.ok) {
      const data = await apiResponse.json();
      if (data.response) {
        return {
          response: data.response,
          corrections: data.corrections ?? [],
        };
      }
    }
    console.warn('[AI] Tutor API returned no response, falling back to mock');
  } catch (err) {
    console.warn('[AI] Tutor API error, falling back to mock:', err);
  }

  // Fallback: mock responses if API is unavailable
  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
  const messageCount = messages.filter((m) => m.role === 'user').length;

  let response: string;

  if (scenario && scenarioResponses[scenario.theme]) {
    const themePool = scenarioResponses[scenario.theme];
    const generalPool = tutorResponses;
    response = Math.random() > 0.4
      ? pickRandom(themePool)
      : pickRandom(generalPool);
  } else {
    response = pickRandom(tutorResponses);
  }

  const corrections: Correction[] = [];
  const shouldCorrect = Math.random() < 0.3 || messageCount % 3 === 0;

  if (shouldCorrect && lastUserMessage) {
    const template = pickRandom(correctionTemplates);
    correctionCounter += 1;
    corrections.push({
      id: generateId(),
      messageId: lastUserMessage.id,
      type: template.type,
      original: template.original,
      corrected: template.corrected,
      explanation: template.explanation,
      severity: template.severity,
    });
  }

  return { response, corrections };
}

export async function generatePronunciationFeedback(
  text: string
): Promise<{ score: number; feedback: string }> {
  const score = Math.floor(Math.random() * 36) + 60; // 60-95
  const applicable = pronunciationFeedbacks.filter(
    (f) => score >= f.minScore && score <= f.maxScore
  );
  const chosen = applicable.length > 0 ? pickRandom(applicable) : pickRandom(pronunciationFeedbacks);

  return { score, feedback: chosen.feedback };
}

// ─────────────────────────────────────────────────────────────────────────────
// Real-time learning helpers (Hint, Translate, Improve)
// ─────────────────────────────────────────────────────────────────────────────

export async function getSpanishHint(
  messages: Message[],
  scenario?: Scenario
): Promise<string> {
  try {
    const res = await fetch('/api/hint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        scenario: scenario ? { context: scenario.context, title: scenario.title } : null,
      }),
    });
    const data = await res.json();
    return data.hint || '';
  } catch (err) {
    console.warn('[AI] Hint API error:', err);
    return '';
  }
}

export interface TranslationResult {
  translation: string;
  translationNl?: string;
  partOfSpeech?: string;
  example?: string;
}

export async function translateText(
  text: string,
  context?: string
): Promise<TranslationResult> {
  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, context }),
    });
    const data = await res.json();
    return {
      translation: data.translation || '',
      translationNl: data.translationNl,
      partOfSpeech: data.partOfSpeech,
      example: data.example,
    };
  } catch (err) {
    console.warn('[AI] Translate API error:', err);
    return { translation: '' };
  }
}

export interface ImprovedSentence {
  improved: string;
  explanation: string;
}

export async function improveSentence(text: string): Promise<ImprovedSentence> {
  try {
    const res = await fetch('/api/improve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    return {
      improved: data.improved || '',
      explanation: data.explanation || '',
    };
  } catch (err) {
    console.warn('[AI] Improve API error:', err);
    return { improved: '', explanation: '' };
  }
}

export function generateSessionSummary(
  messages: Message[],
  corrections: Correction[],
  durationSeconds: number
): {
  duration: number;
  wordsSpoken: number;
  pronunciationScore: number;
  correctionsCount: number;
  highlights: string[];
  focusAreas: string[];
} {
  const userMessages = messages.filter((m) => m.role === 'user');
  const wordsSpoken = userMessages.reduce((sum, m) => sum + m.content.split(/\s+/).length, 0);

  const scores = userMessages
    .map((m) => m.pronunciationScore)
    .filter((s): s is number => s !== undefined);
  const avgScore =
    scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 78;

  const grammarCount = corrections.filter((c) => c.type === 'grammar').length;
  const vocabCount = corrections.filter((c) => c.type === 'vocabulary').length;
  const pronCount = corrections.filter((c) => c.type === 'pronunciation').length;

  const highlights: string[] = [
    'You maintained the conversation flow naturally.',
    `You spoke ${wordsSpoken} words in Spanish — great practice!`,
  ];
  if (avgScore >= 80) {
    highlights.push('Your pronunciation was consistently strong.');
  }
  if (corrections.length <= 2) {
    highlights.push('Very few errors — you are building solid accuracy.');
  }

  const focusAreas: string[] = [];
  if (grammarCount > 0) {
    focusAreas.push(`Grammar: Review verb conjugations and sentence structure (${grammarCount} correction${grammarCount > 1 ? 's' : ''}).`);
  }
  if (vocabCount > 0) {
    focusAreas.push(`Vocabulary: Watch out for false cognates and word choice (${vocabCount} correction${vocabCount > 1 ? 's' : ''}).`);
  }
  if (pronCount > 0) {
    focusAreas.push(`Pronunciation: Practice stress patterns and specific sounds (${pronCount} correction${pronCount > 1 ? 's' : ''}).`);
  }
  if (focusAreas.length === 0) {
    focusAreas.push('Keep expanding your vocabulary with more complex topics.');
    focusAreas.push('Try practicing at a faster conversational speed.');
  }

  return {
    duration: durationSeconds,
    wordsSpoken,
    pronunciationScore: avgScore,
    correctionsCount: corrections.length,
    highlights,
    focusAreas,
  };
}
