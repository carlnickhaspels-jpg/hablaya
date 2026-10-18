// Writes the build identity shared by the app bundle and GET /api/version.
// Railway runs it in the build step (nixpacks.toml: write-build-id.js && expo
// export), so the id is created in the same step as the bundle. It also runs on
// `npm install` (postinstall) and `npm run build:web` (prebuild:web) for local
// use. Uses the Railway commit SHA when available, otherwise a build timestamp.
const fs = require('fs');
const path = require('path');

const builtAt = new Date().toISOString();
const sha = (process.env.RAILWAY_GIT_COMMIT_SHA || '').trim();
const buildId = sha || `t${Date.now()}`;

const target = path.join(__dirname, '..', 'src', 'constants', 'buildId.generated.json');
fs.writeFileSync(target, JSON.stringify({ buildId, builtAt }, null, 2) + '\n');
console.log(`[build-id] ${buildId} (${builtAt})`);
