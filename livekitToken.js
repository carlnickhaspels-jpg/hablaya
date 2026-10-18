const jwt = require('jsonwebtoken');

const VALID_LEVELS = ['silencioso', 'principiante', 'conversador', 'fluido', 'nativo'];
const VALID_TUTORS = ['carlos', 'maria'];
const VALID_CORRECTIONS = ['all', 'important', 'flow'];
const SCENARIO_FIELDS = ['id', 'title', 'titleEs', 'context', 'theme'];
const SCENARIO_MAX_LEN = 500;
const GREETING_MAX_LEN = 1000;

function truncate(value, max) {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

// Normalizes the POST /api/livekit/token request body. Pure function (no I/O)
// so it can be tested without the server. Unknown fields are ignored.
function normalizeTokenRequest(body, userLevel) {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? body : {};

  let level = 'principiante';
  if (VALID_LEVELS.includes(b.level)) level = b.level;
  else if (VALID_LEVELS.includes(userLevel)) level = userLevel;

  let scenario = null;
  if (b.scenario && typeof b.scenario === 'object' && !Array.isArray(b.scenario)) {
    scenario = {};
    for (const key of SCENARIO_FIELDS) scenario[key] = truncate(b.scenario[key], SCENARIO_MAX_LEN);
  }

  const greeting = truncate(b.greeting, GREETING_MAX_LEN);

  const tutor = VALID_TUTORS.includes(b.tutor) ? b.tutor : 'carlos';
  const correction = VALID_CORRECTIONS.includes(b.correction) ? b.correction : 'important';

  return { level, scenario, greeting, tutor, correction };
}

// Mints a LiveKit access token (HS256 JWT) with explicit agent dispatch via
// roomConfig.agents. Claim names match the official livekit-server-sdk format.
function mintLiveKitToken({
  apiKey,
  apiSecret,
  identity,
  name,
  room,
  agentName,
  agentMetadata,
  ttlSeconds = 3600,
}) {
  const now = Math.floor(Date.now() / 1000);
  const metadata = typeof agentMetadata === 'string' ? agentMetadata : JSON.stringify(agentMetadata ?? {});

  const payload = {
    video: {
      room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    },
    roomConfig: {
      agents: [{ agentName, metadata }],
    },
    iss: apiKey,
    sub: identity,
    nbf: now,
    exp: now + ttlSeconds,
  };
  if (name) payload.name = name;

  return jwt.sign(payload, apiSecret, { algorithm: 'HS256', noTimestamp: true });
}

module.exports = {
  mintLiveKitToken,
  normalizeTokenRequest,
  VALID_LEVELS,
  VALID_TUTORS,
  VALID_CORRECTIONS,
};
