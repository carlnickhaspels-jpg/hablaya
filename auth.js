const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('./db');
const email = require('./email');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const TOKEN_EXPIRY_DAYS = 30;

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function readJsonBody(req) {
  if (req._jsonBody) return req._jsonBody;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString();
  return body ? JSON.parse(body) : {};
}

function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

function sanitizeUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    level: u.level,
    subLevel: u.sub_level,
    nativeLanguage: u.native_language,
    targetAccent: u.target_accent,
    isPremium: u.is_premium,
    createdAt: u.created_at,
  };
}

async function issueToken(userId) {
  const token = jwt.sign({ uid: userId }, JWT_SECRET, { expiresIn: `${TOKEN_EXPIRY_DAYS}d` });
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  await db.query(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)',
    [token, userId, expiresAt]
  );
  return token;
}

async function verifyToken(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // Check session row still exists (allows server-side logout)
    const result = await db.query(
      'SELECT u.* FROM users u JOIN sessions s ON s.user_id = u.id WHERE s.token = $1 AND s.expires_at > NOW()',
      [token]
    );
    if (!result.rows.length) return null;
    return result.rows[0];
  } catch {
    return null;
  }
}

function getTokenFromRequest(req) {
  const auth = req.headers['authorization'] || '';
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return null;
}

// ─── Endpoint handlers ──────────────────────────────────────────────────────

async function handleSignup(req, res) {
  if (!db.isConfigured()) {
    return send(res, 503, { error: 'Database not configured. Set DATABASE_URL on the server.' });
  }

  let body;
  try { body = await readJsonBody(req); } catch { return send(res, 400, { error: 'Invalid JSON' }); }
  const { email, name, password, inviteCode } = body;

  if (!isValidEmail(email)) return send(res, 400, { error: 'Please provide a valid email address.' });
  if (!name || typeof name !== 'string' || name.trim().length < 1) return send(res, 400, { error: 'Please provide your name.' });
  if (!password || typeof password !== 'string' || password.length < 6) return send(res, 400, { error: 'Password must be at least 6 characters.' });
  if (!inviteCode || typeof inviteCode !== 'string') return send(res, 400, { error: 'An invite code is required to sign up.' });

  const code = inviteCode.trim().toUpperCase();

  // Validate invite code
  const codeResult = await db.query('SELECT * FROM invite_codes WHERE code = $1', [code]);
  if (!codeResult.rows.length) return send(res, 400, { error: 'Invalid invite code.' });
  const inv = codeResult.rows[0];
  if (inv.expires_at && new Date(inv.expires_at).getTime() < Date.now()) {
    return send(res, 400, { error: 'This invite code has expired.' });
  }
  if (inv.used_count >= inv.max_uses) {
    return send(res, 400, { error: 'This invite code has reached its usage limit.' });
  }

  // Check email not already used
  const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length) return send(res, 409, { error: 'An account with this email already exists. Try signing in.' });

  // Create user
  const passwordHash = await bcrypt.hash(password, 10);
  const result = await db.query(
    `INSERT INTO users (email, name, password_hash, invite_code) VALUES ($1, $2, $3, $4) RETURNING *`,
    [email.toLowerCase(), name.trim(), passwordHash, code]
  );

  // Increment invite usage
  await db.query('UPDATE invite_codes SET used_count = used_count + 1 WHERE code = $1', [code]);

  const user = result.rows[0];
  const token = await issueToken(user.id);
  return send(res, 200, { user: sanitizeUser(user), token });
}

async function handleSignin(req, res) {
  if (!db.isConfigured()) {
    return send(res, 503, { error: 'Database not configured.' });
  }

  let body;
  try { body = await readJsonBody(req); } catch { return send(res, 400, { error: 'Invalid JSON' }); }
  const { email, password } = body;

  if (!isValidEmail(email) || !password) return send(res, 400, { error: 'Email and password are required.' });

  const result = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  if (!result.rows.length) return send(res, 401, { error: 'Invalid email or password.' });

  const user = result.rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return send(res, 401, { error: 'Invalid email or password.' });

  await db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

  const token = await issueToken(user.id);
  return send(res, 200, { user: sanitizeUser(user), token });
}

async function handleMe(req, res) {
  const token = getTokenFromRequest(req);
  if (!token) return send(res, 401, { error: 'Not authenticated' });
  const user = await verifyToken(token);
  if (!user) return send(res, 401, { error: 'Session expired or invalid.' });
  return send(res, 200, { user: sanitizeUser(user) });
}

async function handleSignout(req, res) {
  const token = getTokenFromRequest(req);
  if (token) {
    try { await db.query('DELETE FROM sessions WHERE token = $1', [token]); } catch {}
  }
  return send(res, 200, { ok: true });
}

// ─── Password reset ─────────────────────────────────────────────────────────
//
// Flow:
//   1) User POSTs email to /api/auth/request-password-reset
//   2) If user exists, generate a random token, store it with 1-hour TTL,
//      email them a link with the token.
//   3) Response is ALWAYS "ok" (whether or not the email exists) to avoid
//      leaking which emails are registered (anti-enumeration).
//   4) User clicks link → frontend opens /reset-password?token=... → POSTs
//      token + new password to /api/auth/reset-password
//   5) Server validates token (exists, not expired, not used), updates the
//      user's password hash, marks token used. Old sessions are invalidated.

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

async function handleRequestPasswordReset(req, res) {
  if (!db.isConfigured()) {
    return send(res, 503, { error: 'Database not configured.' });
  }

  let body;
  try { body = await readJsonBody(req); } catch { return send(res, 400, { error: 'Invalid JSON' }); }
  const { email: emailAddr } = body;

  if (!isValidEmail(emailAddr)) {
    // Even for invalid email format we still return "ok" to avoid hinting
    // at validity rules — but skip the DB work.
    return send(res, 200, { ok: true });
  }

  const normalized = emailAddr.toLowerCase();
  const result = await db.query('SELECT id, name, email FROM users WHERE email = $1', [normalized]);

  // Only send an email if the user actually exists, but always return the
  // same response to the caller (prevents email-enumeration via this endpoint).
  if (result.rows.length) {
    const user = result.rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    try {
      await db.query(
        'INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)',
        [token, user.id, expiresAt]
      );

      const result = await email.sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetToken: token,
      });

      if (!result.ok) {
        // Don't leak the error to the client; log it server-side.
        console.error('[auth] Failed to send reset email:', result.error);
      }
    } catch (err) {
      console.error('[auth] Reset token / email error:', err.message);
    }
  }

  return send(res, 200, { ok: true });
}

async function handleResetPassword(req, res) {
  if (!db.isConfigured()) {
    return send(res, 503, { error: 'Database not configured.' });
  }

  let body;
  try { body = await readJsonBody(req); } catch { return send(res, 400, { error: 'Invalid JSON' }); }
  const { token, password } = body;

  if (!token || typeof token !== 'string') {
    return send(res, 400, { error: 'A reset token is required.' });
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    return send(res, 400, { error: 'Password must be at least 6 characters.' });
  }

  // Look up token, check expiry + unused
  const tokenResult = await db.query(
    `SELECT t.user_id, t.expires_at, t.used_at, u.email
       FROM password_reset_tokens t
       JOIN users u ON u.id = t.user_id
      WHERE t.token = $1`,
    [token]
  );

  if (!tokenResult.rows.length) {
    return send(res, 400, { error: 'This reset link is invalid.' });
  }
  const row = tokenResult.rows[0];
  if (row.used_at) {
    return send(res, 400, { error: 'This reset link has already been used. Request a new one.' });
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return send(res, 400, { error: 'This reset link has expired. Request a new one.' });
  }

  // All clear — update password, mark token used, invalidate existing sessions.
  const newHash = await bcrypt.hash(password, 10);
  await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, row.user_id]);
  await db.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE token = $1', [token]);
  await db.query('DELETE FROM sessions WHERE user_id = $1', [row.user_id]);

  return send(res, 200, { ok: true, email: row.email });
}

async function handleUpdateProfile(req, res) {
  const token = getTokenFromRequest(req);
  const user = await verifyToken(token);
  if (!user) return send(res, 401, { error: 'Not authenticated' });

  let body;
  try { body = await readJsonBody(req); } catch { return send(res, 400, { error: 'Invalid JSON' }); }
  const { level, subLevel, nativeLanguage, targetAccent, name } = body;

  const updates = [];
  const params = [];
  let i = 1;
  if (level !== undefined) { updates.push(`level = $${i++}`); params.push(level); }
  if (subLevel !== undefined) { updates.push(`sub_level = $${i++}`); params.push(subLevel); }
  if (nativeLanguage !== undefined) { updates.push(`native_language = $${i++}`); params.push(nativeLanguage); }
  if (targetAccent !== undefined) { updates.push(`target_accent = $${i++}`); params.push(targetAccent); }
  if (name !== undefined) { updates.push(`name = $${i++}`); params.push(name); }

  if (!updates.length) return send(res, 400, { error: 'No fields to update.' });

  params.push(user.id);
  const result = await db.query(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
    params
  );
  return send(res, 200, { user: sanitizeUser(result.rows[0]) });
}

module.exports = {
  handleSignup,
  handleSignin,
  handleMe,
  handleSignout,
  handleUpdateProfile,
  handleRequestPasswordReset,
  handleResetPassword,
  verifyToken,
  getTokenFromRequest,
  sanitizeUser,
  readJsonBody,
};
