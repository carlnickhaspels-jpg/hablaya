/**
 * Build-time constants. Updated manually with each deploy
 * so the Profile screen can show the user which version
 * they have and warn them when their cache is stale.
 */

// Bumped on every deploy. The Profile screen compares this to the
// server's /api/version response.
export const CLIENT_VERSION = '1.2.0';
export const CLIENT_BUILD_AT = '2026-04-28T16:50:00Z';
