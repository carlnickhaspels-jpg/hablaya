// Writes the build identity shared by the app bundle and GET /api/version.
// Runs on `npm install` (postinstall) and before `npm run build:web`, so it is
// created in the same deploy as the exported bundle. Uses the Railway commit
// SHA when available, otherwise a build timestamp.
const fs = require('fs');
const path = require('path');

const builtAt = new Date().toISOString();
const sha = (process.env.RAILWAY_GIT_COMMIT_SHA || '').trim();
const buildId = sha || `t${Date.now()}`;

const target = path.join(__dirname, '..', 'src', 'constants', 'buildId.generated.json');
fs.writeFileSync(target, JSON.stringify({ buildId, builtAt }, null, 2) + '\n');
console.log(`[build-id] ${buildId} (${builtAt})`);
