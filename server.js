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

// ── Whisper transcription endpoint ──────────────────────────────────────────
async function handleTranscribe(req, res) {
  if (!OPENAI_API_KEY) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }));
    return;
  }

  // Collect the raw body (multipart or raw audio)
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks);

  // Build multipart form data for Whisper API
  const boundary = '----HablaYaBoundary' + Date.now();
  const parts = [];

  // Add the audio file part
  parts.push(
    Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="audio.webm"\r\n` +
      `Content-Type: audio/webm\r\n\r\n`
    )
  );
  parts.push(body);
  parts.push(Buffer.from('\r\n'));

  // Add model param
  parts.push(
    Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="model"\r\n\r\n` +
      `whisper-1\r\n`
    )
  );

  // Add language param (Spanish)
  parts.push(
    Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="language"\r\n\r\n` +
      `es\r\n`
    )
  );

  // Close boundary
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
          try {
            const data = JSON.parse(responseBody);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ text: data.text || '' }));
          } catch {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to parse Whisper response', raw: responseBody }));
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

    apiReq.write(formData);
    apiReq.end();
  });
}

// ── Main server ─────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  // CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API endpoint: POST /api/transcribe
  if (req.method === 'POST' && req.url === '/api/transcribe') {
    await handleTranscribe(req, res);
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
  console.log(`Whisper API: ${OPENAI_API_KEY ? 'configured' : 'NOT configured — set OPENAI_API_KEY'}`);
});
