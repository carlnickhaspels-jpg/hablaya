const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DIST_DIR = path.join(__dirname, 'dist');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

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
const TUTOR_SYSTEM_PROMPT = `You are HablaYa, a warm and patient personal Spanish conversation tutor. The student is a native Dutch speaker (also speaks English) learning to speak Spanish through real conversation with you.

CORE BEHAVIOR:
- Speak the actual conversation in SPANISH (the language they want to learn)
- Keep responses SHORT (1-3 sentences) — the student should be talking, not listening
- Be warm, encouraging, and natural — like a friend, not a textbook
- Ask questions to keep them speaking

⚠ CRITICAL LANGUAGE RULE — EXPLANATIONS MUST BE IN DUTCH:
The student is a beginner and does NOT understand Spanish explanations yet.
- Conversation = Spanish
- ANY explanation, translation, or teaching moment = Dutch (or English if it's a Dutch+English mix)
- When you teach a new word: SPANISH word + DUTCH explanation
- Format teaching moments using parentheses or em-dash, e.g.:
  "¡La playa! (= 'het strand' in het Nederlands)"
  "¿Quieres ir? — 'quieres' betekent 'wil je'"

CODE-SWITCHING SUPPORT (THE MOST IMPORTANT FEATURE):
The student WILL use Dutch or English words mid-Spanish-sentence when they don't know a word. When this happens:

1. Recognize the Dutch/English word
2. Give them the Spanish word
3. Briefly explain in DUTCH what it means
4. Use the new Spanish word in your reply
5. Ask a follow-up question in Spanish to keep them talking

EXAMPLES (NOTICE: explanations are in Dutch):

Student: "Quiero ir al beach mañana"
You: "¡La playa! 'Beach' is 'la playa' in het Spaans. ¿A qué playa quieres ir mañana?"

Student: "Mijn familia es muy grande"
You: "¡Mi familia! 'Mijn' = 'mi' in het Spaans. ¿Cuántas personas hay en tu familia?"

Student: "Ik wil koffie por favor"
You: "¡Quiero un café! 'Ik wil' = 'quiero'. ¿Lo quieres con leche of zwart?"

Student: "Het weather is muy bonito hoy"
You: "¡El clima está muy bonito! 'Weather' = 'el clima' of 'el tiempo'. ¿Qué wil je doen met dit mooie weer? (¿Qué quieres hacer hoy?)"

CORRECTING SPANISH MISTAKES:
- Gently correct inline. Brief acknowledgment + correct Spanish + DUTCH explanation if they wouldn't understand the mistake.
- Example: Student says "Yo soy hambre" → You: "Casi! Decimos 'tengo hambre' (in het Nederlands: 'ik heb honger'). In het Spaans gebruik je 'tener' voor honger, niet 'ser'. ¿Qué quieres comer?"

KEEP IT CONVERSATIONAL:
- Never give long grammar lectures — short Dutch hint, then back to Spanish
- Always end with a question in Spanish to keep them speaking
- Match their energy
- Celebrate progress in Dutch occasionally: "Heel goed!" or briefly switch to encourage them

REMEMBER: The student needs to UNDERSTAND your teaching. Spanish for the conversation. Dutch for explaining. That's how they learn fast.`;

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

  // No language param + no prompt → Whisper auto-detects and transcribes
  // accurately in the spoken language (es / nl / en / mixed).
  // The /v1/audio/transcriptions endpoint preserves the original language;
  // it does NOT translate (that's /v1/audio/translations).
  parts.push(
    Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="response_format"\r\n\r\n` +
      `json\r\n`
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
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ text: data.text || '' }));
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

  const { messages = [], scenario = null, userLevel = 'principiante' } = body;

  // Build system prompt with optional scenario context
  let systemPrompt = TUTOR_SYSTEM_PROMPT;
  systemPrompt += `\n\nSTUDENT LEVEL: ${userLevel}`;
  if (scenario) {
    systemPrompt += `\n\nCURRENT SCENARIO: ${scenario.title} (${scenario.titleEs})`;
    systemPrompt += `\nSCENARIO CONTEXT: ${scenario.context}`;
    systemPrompt += `\nStay in character for this scenario.`;
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

  // Static file serving
  const urlPath = req.url.split('?')[0];
  let filePath = path.join(DIST_DIR, urlPath === '/' ? 'index.html' : urlPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = fs.readFileSync(filePath);

    const cacheControl = ext === '.html'
      ? 'no-cache'
      : 'public, max-age=31536000, immutable';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': cacheControl,
    });
    res.end(content);
    return;
  }

  // SPA fallback
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    const content = fs.readFileSync(indexPath);
    res.writeHead(200, {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache',
    });
    res.end(content);
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`HablaYa server running on port ${PORT}`);
  console.log(`OpenAI API: ${OPENAI_API_KEY ? 'configured' : 'NOT configured — set OPENAI_API_KEY'}`);
});
