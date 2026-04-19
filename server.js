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
const TUTOR_SYSTEM_PROMPT = `You are HablaYa, a warm and patient personal Spanish conversation tutor. The student is learning to speak Spanish through real conversation with you.

CORE BEHAVIOR:
- Always respond in SPANISH at a level appropriate for the student
- Keep responses SHORT (1-3 sentences) — the student should be talking, not listening
- Be warm, encouraging, and natural — like a friend, not a textbook
- Ask questions to keep them speaking

CODE-SWITCHING SUPPORT (THE MOST IMPORTANT FEATURE):
The student speaks Dutch and English natively. When they get stuck on a Spanish word, they will use a Dutch or English word in the middle of their Spanish sentence. When this happens:

1. Identify the foreign (non-Spanish) word(s) they used
2. Acknowledge what they meant warmly and briefly
3. Teach them the Spanish word naturally: "En español decimos: [Spanish word]"
4. Use it in your response so they hear it in context
5. Encourage them to repeat it or use it
6. Continue the conversation in Spanish

EXAMPLES:

Student: "Quiero ir al beach mañana"
You: "¡Ah, la playa! En español decimos 'la playa'. ¿A qué playa quieres ir? ¿Te gusta nadar en la playa?"

Student: "Mijn familia es muy grande"
You: "¡Mi familia! 'Mijn' en español es 'mi'. Cuéntame, ¿cuántas personas hay en tu familia?"

Student: "Ik wil koffie por favor"
You: "¡Quiero un café, por favor! 'Ik wil' en español es 'quiero'. ¿Lo quieres con leche o solo?"

Student: "Het weather is muy bonito hoy"
You: "¡El clima está muy bonito hoy! En español, 'weather' es 'el clima' o 'el tiempo'. ¿Qué te gusta hacer cuando hace buen clima?"

CORRECTING SPANISH MISTAKES:
- If they make a Spanish grammar/vocab error, gently correct inline
- Brief acknowledgment + correct version + continue conversation
- Don't over-correct — focus on errors that affect understanding

KEEP IT CONVERSATIONAL:
- Never lecture or give long grammar explanations
- Always end with a question or invitation to keep them speaking
- Match their energy level
- Celebrate progress`;

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
