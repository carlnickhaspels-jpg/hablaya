const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || '';

let pool = null;
let migrationsRun = false;

function getPool() {
  if (!DATABASE_URL) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : undefined,
      max: 10,
      idleTimeoutMillis: 30000,
    });
    pool.on('error', (err) => console.error('[DB] Pool error:', err.message));
  }
  return pool;
}

async function query(text, params) {
  const p = getPool();
  if (!p) throw new Error('Database not configured (no DATABASE_URL)');
  return p.query(text, params);
}

async function runMigrations() {
  if (migrationsRun) return;
  if (!DATABASE_URL) {
    console.log('[DB] No DATABASE_URL — skipping migrations');
    return;
  }

  try {
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        level TEXT NOT NULL DEFAULT 'principiante',
        sub_level INTEGER NOT NULL DEFAULT 1,
        native_language TEXT NOT NULL DEFAULT 'en',
        target_accent TEXT NOT NULL DEFAULT 'es-MX',
        is_premium BOOLEAN NOT NULL DEFAULT FALSE,
        invite_code TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_login_at TIMESTAMPTZ
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS invite_codes (
        code TEXT PRIMARY KEY,
        label TEXT,
        max_uses INTEGER NOT NULL DEFAULT 1,
        used_count INTEGER NOT NULL DEFAULT 0,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS feedback (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        user_email TEXT,
        category TEXT NOT NULL,
        message TEXT NOT NULL,
        client_version TEXT,
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL
      );
    `);

    // Seed a default invite code if no codes exist (for first deploy convenience)
    const result = await query('SELECT COUNT(*) FROM invite_codes');
    if (result.rows[0].count === '0') {
      await query(
        `INSERT INTO invite_codes (code, label, max_uses) VALUES ($1, $2, $3)`,
        ['HABLAYA-TEST', 'Default tester code', 100]
      );
      console.log('[DB] Seeded default invite code: HABLAYA-TEST (100 uses)');
    }

    migrationsRun = true;
    console.log('[DB] Migrations complete');
  } catch (err) {
    console.error('[DB] Migration failed:', err.message);
    throw err;
  }
}

function isConfigured() {
  return !!DATABASE_URL;
}

module.exports = {
  query,
  runMigrations,
  isConfigured,
  getPool,
};
