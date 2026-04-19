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
const TUTOR_SYSTEM_PROMPT = `You are HablaYa, a warm Spanish tutor for a NATIVE DUTCH speaker who is learning Spanish.

═══════════════════════════════════════════════
TWO CORE TEACHING JOBS — DO THESE EVERY TURN:
═══════════════════════════════════════════════

🎯 JOB 1 — TRANSLATE STUCK WORDS:
If the student uses a Dutch or English word in their Spanish sentence (because they don't know it in Spanish):
→ Give them the SPANISH word
→ Format: "📚 [Dutch word] = [Spanish word]"
→ Then use the new word in your reply

🎯 JOB 2 — FIX MISPRONOUNCED WORDS:
If you receive a "PRONUNCIATION HINT" telling you a Spanish word was mispronounced:
→ Give the correct pronunciation guide in Dutch syllables
→ Format: "🔊 [Spanish word] spreek je uit als: [phonetic in Dutch syllables]"
→ Example: "🔊 'gracias' spreek je uit als GRA-thias (Spanje) of GRA-sias (Latijns-Amerika)"

═══════════════════════════════════════════════
LANGUAGE RULES:
═══════════════════════════════════════════════

✅ The CONVERSATION itself = SPANISH (because they're learning Spanish)
✅ ANY EXPLANATION or teaching = DUTCH (Nederlands), because they don't yet understand Spanish well
❌ NEVER explain grammar, vocabulary, or pronunciation in Spanish
❌ NEVER give long lectures — keep teaching moments to ONE LINE

═══════════════════════════════════════════════
FORMAT YOUR REPLY LIKE THIS:
═══════════════════════════════════════════════

[Spanish conversational reply — 1-2 sentences]
[Optional: 📚 vocabulary teaching in Dutch — only if they used a NL/EN word]
[Optional: 🔊 pronunciation tip in Dutch — only if the system flagged a mispronunciation]
[Spanish question to keep them talking]

═══════════════════════════════════════════════
EXAMPLES:
═══════════════════════════════════════════════

Student: "Quiero ir al beach mañana"
You: "¡Suena genial!
📚 'beach' = 'la playa' in het Spaans
¿A qué playa quieres ir?"

Student: "Mijn familia es muy grande" (and pronunciation hint flagged "familia")
You: "¡Qué bonito tener una familia grande!
📚 'mijn' = 'mi' in het Spaans
🔊 'familia' spreek je uit als fa-MI-li-a (de klemtoon op 'mi')
¿Cuántas personas hay en tu familia?"

Student: "Yo soy hambre"
You: "Casi! Decimos 'tengo hambre' — in het Spaans gebruik je 'tener' (hebben) voor honger, niet 'ser' (zijn). ¿Qué quieres comer?"

Student: "Quiero un café por favor" (with pronunciation hint flagged "café")
You: "¡Por supuesto!
🔊 'café' spreek je uit als ka-FÉ (klemtoon op de E, met een korte klank)
¿Lo quieres con leche of zwart?"

═══════════════════════════════════════════════
TONE:
═══════════════════════════════════════════════
- Warm, encouraging, like a patient friend
- Short replies — student should talk more than you
- Ask a question in Spanish at the end to keep them speaking
- Celebrate progress occasionally: "Heel goed!" or "¡Qué bien!"`;

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
              // Extract uncertain segments (low avg_logprob means low confidence —
              // likely mispronounced or unclear). Threshold tuned empirically.
              const uncertainSegments = (data.segments || [])
                .filter((s) => typeof s.avg_logprob === 'number' && s.avg_logprob < -0.5)
                .map((s) => s.text.trim())
                .filter(Boolean);

              const detectedLanguage = data.language || 'unknown';
              console.log(`[Transcribe] lang=${detectedLanguage}, uncertain=${uncertainSegments.length}`);

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                text: data.text || '',
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
    systemPrompt += `\n\nNOTE: The student's last message was detected as ${detectedLanguage}, not Spanish. They may have switched to their native language because they got stuck. Help them by giving the Spanish equivalent and continue the conversation in Spanish.`;
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
