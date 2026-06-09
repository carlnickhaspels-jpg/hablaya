const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const db = require('./db');
const auth = require('./auth');

const PORT = process.env.PORT || 3000;
const DIST_DIR = path.join(__dirname, 'dist');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY || '';
const POSTHOG_HOST = process.env.POSTHOG_HOST || 'https://eu.i.posthog.com';
const serverStartedAt = new Date().toISOString();

// PWA / iOS home-screen meta tags injected into every index.html response
const PWA_META_TAGS = `
  <title>HablaYa — AI Spanish Tutor</title>
  <meta name="description" content="Stop studying. Start speaking. Learn Spanish through real conversations with your personal AI tutor." />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="HablaYa" />
  <meta name="application-name" content="HablaYa" />
  <meta name="theme-color" content="#1A7B72" />
  <link rel="apple-touch-icon" href="/icon.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="/icon.png" />
  <link rel="icon" type="image/png" sizes="192x192" href="/favicon.png" />
  <link rel="manifest" href="/manifest.webmanifest" />
`;

function injectPwaTags(html) {
  // Replace the default title and inject PWA tags inside <head>
  return html
    .replace(/<title>.*?<\/title>/, '')
    .replace('</head>', `${PWA_META_TAGS}</head>`)
    .replace(
      /<meta name="viewport"[^>]*\/>/,
      '<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover, user-scalable=no" />'
    );
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// ── HablaYa AI tutor system prompt ──────────────────────────────────────────
const TUTOR_SYSTEM_PROMPT = `You are HablaYa, a warm and EXPLICIT Spanish teacher for a Dutch native speaker (also speaks English) who is learning Spanish.

You behave like a REAL HUMAN TEACHER, not a chatbot. A real teacher CATCHES non-Spanish words and says "Je bedoelt..." before continuing — they don't just smoothly translate and move on. The student needs to NOTICE that they used a wrong-language word, otherwise they'll never learn.

═══════════════════════════════════════════════════════
THE #1 RULE — CATCH AND TEACH FOREIGN WORDS:
═══════════════════════════════════════════════════════

If the student uses ANY English or Dutch word/phrase in their reply, you MUST:

1. START your reply with: "Je bedoelt: '[Spaans woord]'!" (or for multiple words: "Je bedoelt: '[Spaanse zin]'")
2. Then briefly explain the word(s): "[English/Dutch word] is '[Spanish word]' in het Spaans."
3. THEN model the correct Spanish sentence
4. THEN ask a question in Spanish to keep them talking

NEVER skip step 1. NEVER just smoothly continue in Spanish without calling out the foreign word — the student needs to NOTICE.

═══════════════════════════════════════════════════════
EXAMPLES (study these carefully):
═══════════════════════════════════════════════════════

Student says: "I want to go to the beach"
✅ GOOD reply:
"Je bedoelt: '¡Quiero ir a la playa!' 👇
'I want' = 'quiero', 'beach' = 'la playa'.
Probeer maar: ¿Quieres ir a la playa hoy?"

❌ BAD reply (don't do this):
"¡Suena genial! ¿A qué playa quieres ir?"
(too smooth, student doesn't realize they spoke English)

Student says: "Quiero ir al beach mañana"
✅ GOOD reply:
"Je bedoelt: '¡Quiero ir a la playa mañana!' 👇
'beach' = 'la playa' in het Spaans.
¿A qué playa quieres ir?"

Student says: "Mijn familia es muy grande"
✅ GOOD reply:
"Je bedoelt: '¡Mi familia es muy grande!' 👇
'mijn' = 'mi' in het Spaans.
¿Cuántas personas hay en tu familia?"

Student says: "Ik wil koffie alstublieft"
✅ GOOD reply:
"Je bedoelt: '¡Quiero un café, por favor!' 👇
'ik wil' = 'quiero', 'koffie' = 'café', 'alstublieft' = 'por favor'.
¿Lo quieres con leche of zwart?"

Student says: "I don't know how to say this in Spanish"
✅ GOOD reply:
"Je bedoelt: '¡No sé cómo decir esto en español!' 👇
Geen probleem! Vraag gewoon in het Engels of Nederlands en ik leer je het Spaanse woord. ¿Qué wil je zeggen?"

═══════════════════════════════════════════════════════
WHEN STUDENT SPEAKS CORRECT SPANISH:
═══════════════════════════════════════════════════════

If they spoke fully in Spanish without foreign words, just continue the conversation naturally in Spanish:

Student: "Hola, me llamo Carlos"
You: "¡Hola Carlos! Mucho gusto. ¿De dónde eres?"

(no "Je bedoelt..." needed because nothing to translate)

═══════════════════════════════════════════════════════
WHEN STUDENT MISPRONOUNCES (pronunciation hint flagged):
═══════════════════════════════════════════════════════

Add a 🔊 line BEFORE your question:
"🔊 '[woord]' spreek je uit als [phonetic in Dutch syllables]"

Example:
Student says "Quiero un café" (with 'café' flagged as mispronounced):
"¡Por supuesto!
🔊 'café' spreek je uit als ka-FÉ (klemtoon op de E)
¿Lo quieres con leche of zwart?"

═══════════════════════════════════════════════════════
LANGUAGE RULES:
═══════════════════════════════════════════════════════

✅ The Spanish sentences you model = SPANISH
✅ "Je bedoelt..." prefix = DUTCH (so they understand the teaching)
✅ Word-by-word explanations = DUTCH
✅ Questions to keep them talking = SPANISH
❌ NEVER explain grammar in Spanish
❌ NEVER skip the "Je bedoelt..." callout when they used a foreign word

═══════════════════════════════════════════════════════
STUDENT LEVEL RULES (apply STRICTLY based on STUDENT LEVEL below):
═══════════════════════════════════════════════════════
- silencioso (absolute beginner): MAX 4-5 Spanish words per sentence.
  ALWAYS add the Dutch translation in parentheses RIGHT AFTER each
  Spanish sentence, like: "¿Cómo estás? (= Hoe gaat het?)". Use only
  present tense. Stick to ~50 most common verbs (ser, estar, tener,
  ir, querer, hacer, comer, beber, hablar). NEVER use the subjunctive
  or complex tenses. If you ask a question, make it yes/no or a
  simple "¿Cómo...?" / "¿Qué...?".

- principiante (basics — "knows hola/gracias"): MAX 8 Spanish words
  per sentence. After each Spanish sentence, add a short Dutch gloss
  for any word that is NOT in the top-200 list (numbers, days, common
  food, family words are fine without gloss). Format: "Me gusta el
  café (gusta = vind ik lekker)". Use present + simple past
  (pretérito). Avoid subjunctive entirely.

- conversador (intermediate): natural conversation pace in Spanish.
  Add a Dutch gloss ONLY for clearly uncommon words or idioms.
  Use any tense as needed.

- fluido (advanced): native pace, idiomatic Spanish, no glossing.
  Challenge them with subjunctive, regional expressions, fast turns.

- nativo: treat as a native speaker. No simplification.

═══════════════════════════════════════════════════════
TOPIC ROTATION (anti-drilling rule):
═══════════════════════════════════════════════════════
Real teachers don't drill the same sub-topic forever. Each turn
you'll see "QUESTIONS ASKED IN A ROW: N". Use it like this:
- N = 0–2: keep exploring, ask a normal follow-up.
- N = 3: LAST question on this sub-topic.
- N ≥ 4: STOP asking about the same thing. Either:
  • Make a short statement / observation instead of a question, OR
  • Pivot to a different sub-topic in the scenario
    (e.g. "your family" → "your work" → "your hobbies").
NEVER ask 5+ questions in a row about the same thing. It feels
like an interrogation, not a conversation.

═══════════════════════════════════════════════════════
TONE:
═══════════════════════════════════════════════════════
- Like a warm, patient teacher who genuinely wants you to learn
- Short and direct — no long lectures
- Usually end with a Spanish question — but follow the TOPIC ROTATION rule (sometimes a statement is better)
- Celebrate progress: "¡Muy bien!" or "Heel goed!"`;

// ── Helper: parse JSON body ─────────────────────────────────────────────────
async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString();
  return body ? JSON.parse(body) : {};
}

// ── Whisper transcription endpoint ──────────────────────────────────────────
async function handleTranscribe(req, res) {
  if (!OPENAI_API_KEY) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }));
    return;
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);

  const incomingType = (req.headers['content-type'] || 'audio/webm').toLowerCase();
  // Map browser mime to filename extension Whisper accepts
  let filename = 'audio.webm';
  if (incomingType.includes('mp4') || incomingType.includes('aac')) filename = 'audio.mp4';
  else if (incomingType.includes('ogg')) filename = 'audio.ogg';
  else if (incomingType.includes('wav')) filename = 'audio.wav';

  console.log(`[Transcribe] Received ${body.length} bytes, type=${incomingType}, filename=${filename}`);

  if (body.length < 1000) {
    console.warn('[Transcribe] Audio too small, returning empty');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ text: '' }));
    return;
  }

  const boundary = '----HablaYaBoundary' + Date.now();
  const parts = [];

  parts.push(
    Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: ${incomingType}\r\n\r\n`
    )
  );
  parts.push(body);
  parts.push(Buffer.from('\r\n'));

  parts.push(
    Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="model"\r\n\r\n` +
      `whisper-1\r\n`
    )
  );

  // verbose_json gives us per-segment data with avg_logprob,
  // which we use to flag possibly-mispronounced words for the tutor.
  parts.push(
    Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="response_format"\r\n\r\n` +
      `verbose_json\r\n`
    )
  );

  parts.push(Buffer.from(`--${boundary}--\r\n`));

  const formData = Buffer.concat(parts);

  return new Promise((resolve) => {
    const apiReq = https.request(
      {
        hostname: 'api.openai.com',
        path: '/v1/audio/transcriptions',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': formData.length,
        },
      },
      (apiRes) => {
        const responseChunks = [];
        apiRes.on('data', (chunk) => responseChunks.push(chunk));
        apiRes.on('end', () => {
          const responseBody = Buffer.concat(responseChunks).toString();
          console.log(`[Transcribe] Whisper status=${apiRes.statusCode}, body=${responseBody.substring(0, 200)}`);
          try {
            const data = JSON.parse(responseBody);
            if (data.error) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: data.error.message || data.error }));
            } else {
              const rawText = (data.text || '').trim();

              // Filter Whisper hallucinations on silence/short audio.
              // Whisper has well-documented "go-to" phrases it outputs
              // when there's no real speech.
              const hallucinations = [
                'goodbye', 'bye', 'bye!', 'bye-bye',
                'adios', 'adiós', 'hasta luego', 'chao', 'chau',
                'thank you', 'thank you.', 'thanks', 'thank you for watching',
                'gracias', 'gracias.', 'muchas gracias',
                'subtitles by', 'subtítulos', 'subs by',
                'music', 'música', '[música]', '(music)',
                'see you next time', 'see you',
                'hasta la próxima', 'nos vemos',
                'silence', 'silencio',
                '...', '. . .', '.', ',',
                'you', 'yo', 'oh', 'ah', 'mm', 'hmm',
                'okay', 'ok', 'vale',
                'hi', 'hello', 'hola',
              ];

              const lowerText = rawText.toLowerCase().replace(/[¡¿"'.!?,]/g, '').trim();
              const isHallucination = hallucinations.some(h => lowerText === h || lowerText === h.replace(/[.!,]/g, ''));

              // Also check: very short transcription with no real content is suspicious
              const wordCount = rawText.split(/\s+/).filter(Boolean).length;
              const isTooShort = wordCount <= 2 && rawText.length < 15;
              const looksLikeHallucination = isHallucination || (isTooShort && hallucinations.some(h => lowerText.includes(h)));

              if (looksLikeHallucination) {
                console.log(`[Transcribe] Filtered hallucination: "${rawText}"`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ text: '', filtered: true, reason: 'hallucination' }));
                resolve();
                return;
              }

              // Extract uncertain segments (low avg_logprob means low confidence)
              const uncertainSegments = (data.segments || [])
                .filter((s) => typeof s.avg_logprob === 'number' && s.avg_logprob < -0.5)
                .map((s) => s.text.trim())
                .filter(Boolean);

              const detectedLanguage = data.language || 'unknown';
              console.log(`[Transcribe] lang=${detectedLanguage}, uncertain=${uncertainSegments.length}, text="${rawText.substring(0, 60)}"`);

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                text: rawText,
                detectedLanguage,
                uncertainSegments,
              }));
            }
          } catch {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to parse Whisper response', raw: responseBody.substring(0, 200) }));
          }
          resolve();
        });
      }
    );

    apiReq.on('error', (err) => {
      console.error('[Transcribe] Request error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
      resolve();
    });

    apiReq.write(formData);
    apiReq.end();
  });
}

// ── AI tutor chat endpoint ──────────────────────────────────────────────────
async function handleTutor(req, res) {
  if (!OPENAI_API_KEY) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }));
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON body' }));
    return;
  }

  const {
    messages = [],
    scenario = null,
    userLevel = 'principiante',
    uncertainSegments = [],
    detectedLanguage = null,
  } = body;

  // Build system prompt with optional scenario context
  let systemPrompt = TUTOR_SYSTEM_PROMPT;
  systemPrompt += `\n\nSTUDENT LEVEL: ${userLevel}`;
  if (scenario) {
    systemPrompt += `\n\nCURRENT SCENARIO: ${scenario.title} (${scenario.titleEs})`;
    systemPrompt += `\nSCENARIO CONTEXT: ${scenario.context}`;
    systemPrompt += `\nStay in character for this scenario.`;
  }

  // ── LESSON MODE ───────────────────────────────────────────────
  // When the scenario theme === 'lesson', the tutor is NOT roleplaying a
  // barista/doctor/friend. They are Maria-the-teacher, and the goal is to
  // teach SPECIFIC vocabulary words listed in the scenario context. This
  // block OVERRIDES several default behaviors (the "Je bedoelt" rule and
  // strict short-sentence rule are relaxed because in a lesson the student
  // is EXPECTED to ask questions in Dutch and the tutor explains in Dutch).
  if (scenario && scenario.theme === 'lesson') {
    systemPrompt += `

═══════════════════════════════════════════════════════
LESSON MODE — ACTIVE (overrides default tutor behavior):
═══════════════════════════════════════════════════════
You are MARIA, a cheerful and patient Spanish teacher. Your role this
session is to TEACH, not to roleplay a character. The student is an
absolute beginner — assume they know ONLY the words explicitly taught
in earlier lessons (mentioned in the scenario context). Treat any
Spanish you have not yet introduced as brand new to them.

TEACHING PATTERN — repeat for each target word listed in the scenario context:

  1. Say the Spanish word ALONE, slowly: "Hola"
  2. Give the Dutch meaning: "'Hola' = hallo in het Nederlands"
  3. Use the word in ONE short Spanish sentence (max 5 words):
       "Hola, ¿qué tal?"
  4. Ask the student to repeat it: "Zeg jij ook eens: 'Hola'"
  5. Wait for their response, then praise them in Spanish + Dutch:
       "¡Muy bien!" / "¡Excelente!" / "Heel goed!"
  6. Move to the next word.

After 3-4 words taught: pause to combine them in a tiny sentence the
student should attempt. After ALL target words: do the closing roleplay
or combination task defined in the scenario context.

OVERRIDES vs default tutor behavior:
- DO NOT use the "Je bedoelt:" rule. In a lesson, the student WILL ask
  questions in Dutch or English ("hoe zeg je X?") — that's expected.
  Just answer in Dutch and teach the Spanish.
- Use 50-60% Dutch in your replies (for explanations + praise) and 40-50%
  Spanish (only the target words + short example sentences).
- Be VISUALLY warm: use emoji like 🎉 👏 ✨ ⭐ generously.
- Energy is high — short bursts of enthusiasm, not long lectures.
- Topic-rotation rule does NOT apply here — you're working through a
  fixed list of words, not free-form chatting. Ignore the "QUESTIONS
  ASKED IN A ROW" count.
- When student attempts a Spanish word: be generous with praise even if
  pronunciation is imperfect. The point is to BUILD CONFIDENCE.
- End the lesson by telling the student what they just learned and
  congratulating them. Suggest they try the next lesson.`;
  }

  // Topic rotation: count consecutive tutor messages ending with '?'
  const tutorMsgs = messages.filter((m) => m.role === 'tutor');
  let consecutiveQuestions = 0;
  for (let i = tutorMsgs.length - 1; i >= 0; i--) {
    const content = (tutorMsgs[i].content || '').trim();
    if (content.endsWith('?')) consecutiveQuestions++;
    else break;
  }
  systemPrompt += `\n\nQUESTIONS ASKED IN A ROW: ${consecutiveQuestions}`;

  // Inject pronunciation hints from Whisper confidence data
  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
  if (lastUserMessage && uncertainSegments.length > 0) {
    systemPrompt += `\n\n⚠ PRONUNCIATION HINT FROM SPEECH-TO-TEXT:`;
    systemPrompt += `\nThe student's last spoken message contained these UNCERTAIN segments (Whisper had low confidence — they were likely MISPRONOUNCED or unclear):`;
    uncertainSegments.forEach((seg) => {
      systemPrompt += `\n  - "${seg}"`;
    });
    systemPrompt += `\nIf these contain Spanish words, give a brief pronunciation tip in Dutch using format like: "Tip: 'gracias' spreek je uit als GRA-thias (Spanje) of GRA-sias (Latijns-Amerika), niet GRA-sees."`;
  }

  if (lastUserMessage && detectedLanguage && detectedLanguage !== 'spanish' && detectedLanguage !== 'es') {
    systemPrompt += `\n\n⚠ LANGUAGE DETECTED: Student's last message was in ${detectedLanguage.toUpperCase()}, not Spanish. APPLY THE #1 RULE: start your reply with "Je bedoelt: '[full Spanish translation]'!" then teach them the words.`;
  }

  // Convert messages to OpenAI format
  const chatMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role === 'tutor' ? 'assistant' : 'user',
      content: m.content,
    })),
  ];

  const requestBody = JSON.stringify({
    model: 'gpt-4o-mini',
    messages: chatMessages,
    temperature: 0.8,
    max_tokens: 250,
  });

  return new Promise((resolve) => {
    const apiReq = https.request(
      {
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody),
        },
      },
      (apiRes) => {
        const responseChunks = [];
        apiRes.on('data', (chunk) => responseChunks.push(chunk));
        apiRes.on('end', () => {
          const responseBody = Buffer.concat(responseChunks).toString();
          try {
            const data = JSON.parse(responseBody);
            const text = data.choices?.[0]?.message?.content?.trim() || '';
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ response: text, corrections: [] }));
          } catch {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to parse OpenAI response', raw: responseBody }));
          }
          resolve();
        });
      }
    );

    apiReq.on('error', (err) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
      resolve();
    });

    apiReq.write(requestBody);
    apiReq.end();
  });
}

// ── Helper: simple OpenAI chat completion ───────────────────────────────────
async function callOpenAI(systemPrompt, userPrompt, maxTokens = 200) {
  const requestBody = JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.6,
    max_tokens: maxTokens,
  });

  return new Promise((resolve, reject) => {
    const apiReq = https.request(
      {
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody),
        },
      },
      (apiRes) => {
        const responseChunks = [];
        apiRes.on('data', (chunk) => responseChunks.push(chunk));
        apiRes.on('end', () => {
          const responseBody = Buffer.concat(responseChunks).toString();
          try {
            const data = JSON.parse(responseBody);
            const text = data.choices?.[0]?.message?.content?.trim() || '';
            resolve(text);
          } catch (err) {
            reject(new Error('Invalid OpenAI response'));
          }
        });
      }
    );
    apiReq.on('error', reject);
    apiReq.write(requestBody);
    apiReq.end();
  });
}

// ── Hint endpoint: suggest a Spanish phrase based on context ───────────────
async function handleHint(req, res) {
  if (!OPENAI_API_KEY) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }));
    return;
  }

  let body;
  try { body = await readJsonBody(req); } catch { body = {}; }
  const { messages = [], scenario = null } = body;

  const lastTutorMessage = [...messages].reverse().find((m) => m.role === 'tutor');
  const recentContext = messages.slice(-4).map((m) => `${m.role}: ${m.content}`).join('\n');

  const systemPrompt = `You are a Spanish tutor helping a Dutch-speaking student who is stuck. Suggest ONE short, natural Spanish reply (1-2 sentences max) at a beginner level the student could use right now to continue the conversation.

Output format: ONLY the Spanish phrase, nothing else. No quotes, no Dutch, no explanations.${
    scenario ? `\n\nScenario context: ${scenario.context}` : ''
  }`;

  const userPrompt = `Recent conversation:\n${recentContext}\n\nThe student is stuck. Give them ONE short Spanish phrase they could say next.`;

  try {
    const hint = await callOpenAI(systemPrompt, userPrompt, 80);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ hint }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

// ── Translate endpoint: word or phrase translation ─────────────────────────
async function handleTranslate(req, res) {
  if (!OPENAI_API_KEY) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }));
    return;
  }

  let body;
  try { body = await readJsonBody(req); } catch { body = {}; }
  const { text = '', context = '' } = body;

  if (!text.trim()) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'No text provided' }));
    return;
  }

  const systemPrompt = `You are a Spanish↔Dutch/English translator for a Dutch-speaking learner. Given a word or phrase, provide a CONCISE translation. Dutch is the student's native language so prioritize the Dutch translation.

Output format (JSON only, no markdown):
{
  "translation": "the translation in English",
  "translationNl": "the translation in Dutch (Nederlands) — REQUIRED",
  "partOfSpeech": "noun/verb/adjective/etc (in Dutch: zelfstandig naamwoord / werkwoord / etc)",
  "example": "a short example sentence using the Spanish word in context"
}`;

  const userPrompt = `Word/phrase: "${text}"${context ? `\nContext: "${context}"` : ''}`;

  try {
    const result = await callOpenAI(systemPrompt, userPrompt, 200);
    // Try to parse as JSON, fall back to plain text
    let parsed;
    try {
      const cleaned = result.replace(/^```json\s*|\s*```$/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { translation: result };
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(parsed));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

// ── Improve endpoint: native-like version of user's sentence ──────────────
async function handleImprove(req, res) {
  if (!OPENAI_API_KEY) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }));
    return;
  }

  let body;
  try { body = await readJsonBody(req); } catch { body = {}; }
  const { text = '' } = body;

  if (!text.trim()) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'No text provided' }));
    return;
  }

  const systemPrompt = `You are a Spanish language coach for a Dutch-speaking student. They just said something in Spanish (possibly mixing in Dutch or English words). Show them how a native Spanish speaker would say it — natural, fluent, idiomatic.

Output format (JSON only, no markdown):
{
  "improved": "the natural native Spanish version",
  "explanation": "1-2 sentences in DUTCH (Nederlands) explaining what changed and why. Use Dutch because the student is a Dutch native speaker."
}`;

  const userPrompt = `Student said: "${text}"`;

  try {
    const result = await callOpenAI(systemPrompt, userPrompt, 200);
    let parsed;
    try {
      const cleaned = result.replace(/^```json\s*|\s*```$/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { improved: result, explanation: '' };
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(parsed));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

// ── TTS endpoint: multilingual text-to-speech via OpenAI ───────────────────
async function handleTTS(req, res) {
  if (!OPENAI_API_KEY) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }));
    return;
  }

  let body;
  if (req._jsonBody) {
    body = req._jsonBody;
  } else {
    try { body = await readJsonBody(req); } catch { body = {}; }
  }
  const { text = '', voice = 'nova' } = body;

  if (!text || !text.trim()) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'No text provided' }));
    return;
  }

  // Strip emoji, markdown, and special formatting that the TTS would read literally
  const cleaned = text
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/gu, '') // emoji
    .replace(/👇|→|↑|↓/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .trim();

  // tts-1 is ~5-10x faster than gpt-4o-mini-tts and quality is still
  // very natural for conversational use. The slower hi-fi model isn't
  // worth a 3-5 second delay on every reply.
  const requestBody = JSON.stringify({
    model: 'tts-1',
    voice,
    input: cleaned,
    response_format: 'mp3',
    speed: 1.0,
  });

  return new Promise((resolve) => {
    const apiReq = https.request(
      {
        hostname: 'api.openai.com',
        path: '/v1/audio/speech',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody),
        },
      },
      (apiRes) => {
        if (apiRes.statusCode !== 200) {
          const errChunks = [];
          apiRes.on('data', (chunk) => errChunks.push(chunk));
          apiRes.on('end', () => {
            const errBody = Buffer.concat(errChunks).toString();
            console.error('[TTS] OpenAI error:', apiRes.statusCode, errBody.substring(0, 200));
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'TTS API error', detail: errBody.substring(0, 200) }));
            resolve();
          });
          return;
        }

        // Stream the mp3 back to the client
        res.writeHead(200, {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'no-store',
        });
        apiRes.pipe(res);
        apiRes.on('end', () => resolve());
      }
    );

    apiReq.on('error', (err) => {
      console.error('[TTS] Request error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
      resolve();
    });

    apiReq.write(requestBody);
    apiReq.end();
  });
}

// ── Feedback endpoint ──────────────────────────────────────────────────────
async function handleFeedback(req, res) {
  if (!db.isConfigured()) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Database not configured' }));
    return;
  }

  let body;
  try { body = await auth.readJsonBody(req); }
  catch { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Invalid JSON' })); return; }

  const { category, message, clientVersion } = body;
  if (!message || typeof message !== 'string' || !message.trim()) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Please write a message.' }));
    return;
  }

  const validCategories = ['bug', 'idea', 'praise', 'other'];
  const cat = validCategories.includes(category) ? category : 'other';

  // Identify user if logged in (optional)
  const token = auth.getTokenFromRequest(req);
  const user = token ? await auth.verifyToken(token) : null;
  const userAgent = (req.headers['user-agent'] || '').slice(0, 500);

  await db.query(
    `INSERT INTO feedback (user_id, user_email, category, message, client_version, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      user ? user.id : null,
      user ? user.email : null,
      cat,
      message.trim().slice(0, 5000),
      (clientVersion || '').toString().slice(0, 50),
      userAgent,
    ]
  );

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true }));
}

// ── Public config endpoint (returns env-controlled flags to client) ─────────
function handleConfig(req, res) {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=60',
  });
  res.end(JSON.stringify({
    posthogKey: POSTHOG_API_KEY || null,
    posthogHost: POSTHOG_HOST,
    requiresInviteCode: db.isConfigured(),
  }));
}

// ── Main server ─────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/api/transcribe') {
    await handleTranscribe(req, res);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/tutor') {
    await handleTutor(req, res);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/hint') {
    await handleHint(req, res);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/translate') {
    await handleTranslate(req, res);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/improve') {
    await handleImprove(req, res);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/tts') {
    await handleTTS(req, res);
    return;
  }

  // GET version for direct streaming via <audio src=…> — much lower
  // perceived latency because the browser starts playing the moment
  // the first audio bytes arrive instead of waiting for the full Blob.
  if (req.method === 'GET' && req.url.startsWith('/api/tts?')) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const text = url.searchParams.get('text') || '';
    const voice = url.searchParams.get('voice') || 'nova';
    // Reuse the POST handler by faking a JSON body
    req._jsonBody = { text, voice };
    await handleTTS(req, res);
    return;
  }

  // ─── Auth endpoints ────────────────────────────────────────────
  if (req.method === 'POST' && req.url === '/api/auth/signup') {
    await auth.handleSignup(req, res);
    return;
  }
  if (req.method === 'POST' && req.url === '/api/auth/signin') {
    await auth.handleSignin(req, res);
    return;
  }
  if (req.method === 'GET' && req.url === '/api/auth/me') {
    await auth.handleMe(req, res);
    return;
  }
  if (req.method === 'POST' && req.url === '/api/auth/signout') {
    await auth.handleSignout(req, res);
    return;
  }
  if (req.method === 'PATCH' && req.url === '/api/auth/profile') {
    await auth.handleUpdateProfile(req, res);
    return;
  }
  if (req.method === 'POST' && req.url === '/api/auth/request-password-reset') {
    await auth.handleRequestPasswordReset(req, res);
    return;
  }
  if (req.method === 'POST' && req.url === '/api/auth/reset-password') {
    await auth.handleResetPassword(req, res);
    return;
  }

  // ─── Feedback ──────────────────────────────────────────────────
  if (req.method === 'POST' && req.url === '/api/feedback') {
    await handleFeedback(req, res);
    return;
  }

  // ─── Public client config ──────────────────────────────────────
  if (req.method === 'GET' && req.url.split('?')[0] === '/api/config') {
    handleConfig(req, res);
    return;
  }

  // Version endpoint — returns when the server was deployed.
  // The client compares this to its build constant to detect stale caches.
  if (req.method === 'GET' && req.url.split('?')[0] === '/api/version') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify({
      version: process.env.RAILWAY_GIT_COMMIT_SHA || 'dev',
      deployedAt: process.env.RAILWAY_DEPLOYMENT_CREATED_AT || new Date().toISOString(),
      startedAt: serverStartedAt,
    }));
    return;
  }

  // PWA manifest (served dynamically so we don't need to ship a separate file)
  if (req.method === 'GET' && req.url.split('?')[0] === '/manifest.webmanifest') {
    const manifest = {
      name: 'HablaYa — AI Spanish Tutor',
      short_name: 'HablaYa',
      description: 'Stop studying. Start speaking. Learn Spanish through real conversations with your personal AI tutor.',
      lang: 'nl',
      dir: 'ltr',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#1A7B72',
      theme_color: '#1A7B72',
      categories: ['education', 'productivity'],
      icons: [
        { src: '/favicon.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icon.png', sizes: '1024x1024', type: 'image/png', purpose: 'any' },
        { src: '/icon.png', sizes: '1024x1024', type: 'image/png', purpose: 'maskable' },
      ],
    };
    res.writeHead(200, {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=3600',
    });
    res.end(JSON.stringify(manifest));
    return;
  }

  // Serve brand assets from /assets/ at the root so they can be referenced
  // simply as /icon.png and /favicon.png from manifest + meta tags.
  const ASSET_ALIASES = {
    '/icon.png': 'icon.png',
    '/favicon.png': 'favicon.png',
    '/favicon.ico': 'favicon.png',
    '/apple-touch-icon.png': 'icon.png',
    '/logo.svg': 'logo.svg',
  };
  const aliasKey = req.url.split('?')[0];
  if (req.method === 'GET' && ASSET_ALIASES[aliasKey]) {
    const assetPath = path.join(__dirname, 'assets', ASSET_ALIASES[aliasKey]);
    if (fs.existsSync(assetPath)) {
      const ext = path.extname(assetPath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=86400',
      });
      res.end(fs.readFileSync(assetPath));
      return;
    }
  }

  // Static file serving
  const urlPath = req.url.split('?')[0];
  let filePath = path.join(DIST_DIR, urlPath === '/' ? 'index.html' : urlPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const cacheControl = ext === '.html'
      ? 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
      : 'public, max-age=31536000, immutable';

    if (ext === '.html') {
      const html = fs.readFileSync(filePath, 'utf8');
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': cacheControl,
        'Pragma': 'no-cache',
        'Expires': '0',
      });
      res.end(injectPwaTags(html));
    } else {
      res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': cacheControl });
      res.end(fs.readFileSync(filePath));
    }
    return;
  }

  // SPA fallback
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    const html = fs.readFileSync(indexPath, 'utf8');
    res.writeHead(200, {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    res.end(injectPwaTags(html));
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, async () => {
  console.log(`HablaYa server running on port ${PORT}`);
  console.log(`OpenAI API: ${OPENAI_API_KEY ? 'configured' : 'NOT configured — set OPENAI_API_KEY'}`);
  console.log(`PostHog: ${POSTHOG_API_KEY ? 'configured' : 'NOT configured (optional)'}`);
  console.log(`Database: ${db.isConfigured() ? 'configured' : 'NOT configured — set DATABASE_URL for auth/feedback'}`);

  if (db.isConfigured()) {
    try {
      await db.runMigrations();
    } catch (err) {
      console.error('[Server] Database migrations failed — auth and feedback will be disabled');
    }
  }
});
