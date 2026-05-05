# HablaYa — AI Spanish Speaking Tutor

PWA + Express server in one Railway container. Helps Dutch native speakers learn Spanish through real spoken conversations with an AI tutor that catches code-switching ("Je bedoelt: la playa!") and corrects pronunciation.

Live at: **https://hablaya-production.up.railway.app**
Repo: **https://github.com/carlnickhaspels-jpg/hablaya**
Railway project: **Hablaya Spanish learning** (project id `4d0fa1aa-1dbd-4410-98ed-78d28595e9b6`)

---

## Architecture

Single Node service that does double duty:

1. **Static file server** for the Expo Router web build (output in `/dist`)
2. **API gateway** that proxies to OpenAI (Whisper, GPT-4o-mini, TTS) and serves auth/feedback against Postgres

Frontend is React Native via Expo Router — only ships to web for now (the audio code uses MediaRecorder + Web Audio API which would need replacing with `expo-av` for native).

```
┌─────────────────────────────────────────┐
│  iPhone Safari (PWA)                    │
│   - Expo Router web bundle              │
│   - MediaRecorder + Web Speech APIs    │
│   - HTML <audio> for TTS streaming      │
└─────────────────────────────────────────┘
              │ HTTPS
              ▼
┌─────────────────────────────────────────┐
│  Railway: hablaya service (server.js)   │
│   - Serves /dist static files            │
│   - /api/auth/* (JWT, bcrypt)            │
│   - /api/transcribe → OpenAI Whisper    │
│   - /api/tutor → GPT-4o-mini            │
│   - /api/tts → tts-1 (streamed)         │
│   - /api/hint, /api/translate,           │
│     /api/improve, /api/feedback         │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  Railway: Postgres service               │
│   - users, sessions, invite_codes,       │
│     feedback                             │
└─────────────────────────────────────────┘
```

---

## Required env vars (Railway → hablaya service → Variables)

| Var | Purpose | Required |
|---|---|---|
| `OPENAI_API_KEY` | Whisper, GPT-4o-mini, tts-1 | ✅ Yes |
| `DATABASE_URL` | Postgres connection (set as `${{Postgres.DATABASE_URL}}` reference) | ✅ Yes — without it, signup fails |
| `JWT_SECRET` | Signing user session tokens. 32+ random chars | ✅ Yes |
| `POSTHOG_API_KEY` | Analytics (free tier on posthog.com) | Optional |
| `POSTHOG_HOST` | `https://eu.i.posthog.com` or `.us.` | Optional |
| `PORT` | Auto-injected by Railway | Auto |

---

## Key files

### Backend
- `server.js` — HTTP server. Routes table is in the bottom `createServer` callback. New endpoints add their handler above and a route entry inline.
- `db.js` — Postgres pool + auto-migrations. Tables defined in `runMigrations()`. Adds a default invite code `HABLAYA-TEST` (100 uses) on first deploy.
- `auth.js` — All auth endpoints: signup (validates invite code), signin, me, signout, profile update. JWT-based with server-side session table for revocation.

### Client services (`src/services/`)
- `ai.ts` — `generateTutorResponse`, `getSpanishHint`, `translateText`, `improveSentence`, `generatePronunciationFeedback`. All call backend endpoints; falls back to mock data only if API errors.
- `speech.ts` — `startRecording`/`stopRecording` (MediaRecorder → Whisper), `playAudio` (streams /api/tts via `<audio>`), with `expo-speech` fallback. **VAD was removed in v2** — push-to-toggle only.
- `authApi.ts` — JWT in AsyncStorage, calls all `/api/auth/*` endpoints, includes `submitFeedback`.
- `analytics.ts` — Lazy PostHog init via `/api/config`. No-op when key missing or on native.

### Client UI
- `app/_layout.tsx` — Root stack + `<PwaInstallBanner />` + analytics page-view tracking
- `app/(auth)/sign-up.tsx` — Email + password + name + **invite code** required
- `app/conversation/[id].tsx` — The hero screen. Tap-to-toggle mic, hint button, translate-on-tap, improve button. Plays AI replies via streamed TTS.
- `src/components/`:
  - `MicButton` — pulses orange in awaiting-reply state
  - `PickerModal` / `ConfirmModal` — used everywhere instead of `Alert.alert` (which is unreliable on web)
  - `FeedbackModal`, `PwaInstallBanner`, `TranslatePopup`, `ImprovePopup`, `HintBar`, `CorrectionCard`

---

## Conversation flow (the core UX)

1. User taps mic → `startRecording()` opens `getUserMedia` + MediaRecorder
2. User taps mic again → `stopRecording()` stops recorder → POST audio blob to `/api/transcribe`
3. Server forwards to OpenAI Whisper (verbose_json) → filters known hallucinations ("Goodbye", "Thanks for watching" etc.) → returns `{text, detectedLanguage, uncertainSegments}`
4. Client adds user message bubble, then calls `/api/tutor` with full message history + scenario context + uncertain segments + detected language
5. Server's TUTOR_SYSTEM_PROMPT (in `server.js`) tells GPT-4o-mini to:
   - Catch any English/Dutch words → start reply with **"Je bedoelt: ..."**
   - For mispronounced words (from uncertainSegments) → 🔊 pronunciation tip in Dutch
   - Keep replies short, end with a Spanish question
6. Tutor reply → client adds bubble → starts streaming `/api/tts?text=...&voice=nova` via `<audio src=…>`
7. Mic enters "awaiting reply" pulse state → user taps → loop

---

## Deployment workflow

```bash
# 1. Make changes
# 2. Bump version in src/constants/build.ts (CLIENT_VERSION + CLIENT_BUILD_AT)
# 3. Commit + push:
git add -A && git commit -m "..." && git push origin master
```

Railway auto-deploys on push to master. Build steps from `nixpacks.toml`:
1. `npm install`
2. `npx expo export --platform web` → outputs to `/dist`
3. `node server.js` runs the static + API server

Build time: ~2-3 minutes from push.

### Verify a deploy is live
```bash
curl https://hablaya-production.up.railway.app/api/version
# Compare returned version (commit SHA) with current git HEAD
```

The Profile screen shows live "Up to date" / "Update available" banner using this endpoint.

---

## Common gotchas

### iOS Safari PWA caching is brutal
HTML responses set `Cache-Control: no-store, no-cache, must-revalidate` + `Pragma: no-cache` — but iOS PWAs sometimes still serve stale. The Profile screen has two escape hatches:
- **🔄 Force Update Now** — unregisters service workers, clears Cache Storage, reloads with `?_t=<timestamp>`
- **🗑 Clear All Cached Data** — also wipes localStorage, sessionStorage, IndexedDB

### Web Speech API (SpeechRecognition) doesn't work on iOS
That's why we use MediaRecorder + Whisper instead. Don't add `webkitSpeechRecognition` back — it's broken on iPhone.

### `Alert.alert` doesn't work on web
React Native Web's Alert is silent for multi-button alerts. Always use `PickerModal` or `ConfirmModal` instead.

### JSX text content doesn't process `\u00XX` escapes
`<Text>¡Hola</Text>` renders literally. Wrap in template literal: `<Text>{\`¡Hola\`}</Text>` or use the actual `¡` character.

### TTS model choice matters massively
`gpt-4o-mini-tts` adds 3-5s latency. We use `tts-1` instead — slightly less hi-fi but native enough and 5-10x faster.

### Whisper hallucinates on silence
Returns "Goodbye", "Thank you", "Music", "Subtítulos" etc. when given near-silent audio. Server filters these — see `hallucinations` array in `handleTranscribe`.

### Cost per active user
- Whisper: ~$0.006/min of audio
- GPT-4o-mini: ~$0.0001 per turn
- tts-1: ~$0.015 per 1000 chars (~$0.001 per AI reply)
- Total: ~$0.01-0.05 per conversation session

---

## Adding a new conversation scenario

Edit `src/constants/scenarios.ts`. Each scenario:
```ts
{
  id: 'theme-name-kebab',  // becomes the URL: /conversation/theme-name-kebab
  title: 'English Title',
  titleEs: 'Título en Español',
  description: 'Brief context shown on the card',
  theme: 'travel' | 'social' | 'daily-life' | 'work',
  difficulty: 1-5,
  estimatedMinutes: 3-8,
  context: 'What the AI tutor needs to know about the scenario (sets the role-play). Include character details, setting, conversational goal.',
  starterPrompt: 'The first thing the AI says in Spanish to start the conversation.',
  tags: ['array', 'of', 'tags'],
}
```

The `context` is injected into the tutor's system prompt for that conversation, so the AI stays in character (waiter, colleague, friend, etc.).

---

## Tester invite codes

Default code seeded on first DB migration: **`HABLAYA-TEST`** (100 uses).

To add a new code via SQL on Railway Postgres:
```sql
INSERT INTO invite_codes (code, label, max_uses) VALUES ('CODE-NAME', 'Description', 50);
```

---

## What was tried and abandoned

- **Voice Activity Detection (VAD)** — RMS-based VAD using Web Audio API. Worked in theory but was unreliable: iOS Safari auto-suspends AudioContext after media playback, echo cancellation isn't perfect (TTS leaks back into mic), threshold tuning was impossible across environments. Replaced with simple tap-to-toggle in v2.
- **Web Speech API (`webkitSpeechRecognition`)** — Doesn't work on iOS. Replaced with MediaRecorder + Whisper.
- **`Alert.alert`** — Silently fails for multi-button on web. Replaced with custom Modal components.
- **`gpt-4o-mini-tts`** — Too slow (3-5s latency). Replaced with `tts-1` (sub-second).
- **`expo-speech` for primary TTS** — Single-language voice only (es-MX), butchers Dutch words. Replaced with OpenAI TTS streamed via `<audio>`. Kept as fallback when /api/tts fails.

---

## Future work (if revived)

- Real iOS native app via Expo EAS Build (requires swapping MediaRecorder/Web Audio for `expo-av`, $99/year Apple Developer Account)
- Conversation history persistence (sessions table exists but isn't populated yet — only auth sessions live there)
- Per-user progress tracking (streaks, fluency score, error trends are currently mocked in UI from `app/(tabs)/progress.tsx` MOCK_RECENT_SESSIONS)
- Stripe subscription (the paywall screen exists at `app/(tabs)/subscription.tsx` but doesn't actually charge)
- Spaced repetition for vocabulary the user struggled with
- Voice cloning so each tutor has a distinct character voice
