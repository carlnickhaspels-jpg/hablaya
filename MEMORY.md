# HablaYa — Decisions Log

## 2026-04-28, Tap-to-toggle als enige speak-mode (geen VAD meer)
**What was decided:** Mic werkt via simpele tap-to-toggle (1 tik start, 1 tik stop). Na AI-antwoord pulseert de mic zacht oranje als invitation.
**Why:** VAD (voice activity detection) is fundamenteel onbetrouwbaar in mobiele browsers — iOS Safari suspendt AudioContext na audio-playback, echo-cancellation lekt TTS terug naar mic, threshold-tuning werkt niet voor alle omgevingen.
**What was rejected:** Web Audio API VAD met RMS-threshold + cooldown na resume (geprobeerd, flickerde tussen "Listening" en "Hearing you"); MediaSource streaming voor lagere TTS latency (te complex voor de winst).

## 2026-04-28, OpenAI tts-1 ipv gpt-4o-mini-tts
**What was decided:** TTS draait op `tts-1` model met `nova` voice, gestreamd via `<audio src="/api/tts?text=...">`.
**Why:** gpt-4o-mini-tts gaf 3-5s latency per AI-antwoord. tts-1 is 5-10x sneller, kwaliteit is goed genoeg voor conversatie. Streaming via `<audio>` start playback bij eerste bytes ipv te wachten op volledige Blob.
**What was rejected:** ElevenLabs (extra API key, kosten); expo-speech als primary (single-language, butchert NL woorden).

## 2026-04-28, OpenAI als enige AI-provider
**What was decided:** Whisper voor STT, GPT-4o-mini voor tutor + hint + translate + improve, tts-1 voor TTS. Alles via één `OPENAI_API_KEY`.
**Why:** Eén key, één rekening, één SDK. GPT-4o-mini is goedkoop genoeg (~$0.0001 per turn). Claude was originele plan in de blueprint maar zou een tweede API key + integratie betekenen.
**What was rejected:** Claude Sonnet voor tutoring (brengt geen significante kwaliteitsverbetering voor deze use case); Deepgram voor STT (Whisper werkt prima, één minder API).

## 2026-04-28, Postgres in dezelfde Railway project ipv Supabase
**What was decided:** Postgres service in dezelfde Railway project ("Hablaya Spanish learning") met directe `pg` connection vanuit server.js. JWT-auth via eigen endpoints in auth.js.
**Why:** Minder platformen om te beheren. Postgres + Express + static serve in één container is makkelijker te debuggen. Auth is simpel genoeg om zelf te schrijven (bcrypt + jsonwebtoken).
**What was rejected:** Supabase (extra platform, overkill voor MVP); NextAuth (vereist Next.js); Auth0 (paid, complex).

## 2026-04-28, Invite-code gated signup voor private beta
**What was decided:** Signup vereist `inviteCode` veld, gevalideerd tegen `invite_codes` table. Default code `HABLAYA-TEST` wordt geseed bij eerste DB-migratie (100 uses).
**Why:** Voorkomt dat random bezoekers OpenAI credits eten. Gives Carl control over wie test.
**What was rejected:** Open signup met rate-limiting (te makkelijk te misbruiken); waitlist (extra friction, geen gated invite-codes).

## 2026-04-28, PWA als distributiemodel ipv native iOS app
**What was decided:** App distribueert als PWA via Safari "Add to Home Screen". Geen App Store, geen TestFlight, geen Apple Developer Account.
**Why:** Geen €99/jaar fee, geen review process, updates landen direct bij elke push, code blijft web-only (MediaRecorder + Web Audio API).
**What was rejected:** Expo EAS Build naar iOS native (vereist Apple Developer Account + native audio code rewrite via expo-av); React Native via Expo Go (alleen voor development).

## 2026-04-28, Custom Modal componenten ipv Alert.alert
**What was decided:** Alle multi-button alerts gebruiken `PickerModal` of `ConfirmModal` (eigen components in src/components/).
**Why:** React Native Web's Alert.alert is silent voor multi-button alerts in browsers — knoppen doen niets. Eigen Modals werken consistent op web + native.
**What was rejected:** window.confirm/prompt (lelijk, niet stylable); externe modal library (extra dependency).

## 2026-04-28, GPT-4o-mini system prompt gebruikt Nederlands voor uitleg
**What was decided:** Tutor-conversatie blijft in Spaans, maar elke uitleg/correctie/teaching moment is in het Nederlands. Format: "Je bedoelt: '[Spaanse zin]'! 👇 [Dutch word] = [Spanish word]". Als Whisper een woord met low confidence transcribeert, krijgt de tutor een hint en geeft 🔊 pronunciation tip in NL.
**Why:** Carl is NL native, beginner Spaans. Spaanse uitleg is onbegrijpelijk voor hem. Echte leraar-gedrag = expliciet "Je bedoelt..." zeggen ipv smooth doortranslaten.
**What was rejected:** Engelse uitleg (NL beter voor NL native); alleen Spanish met emoji-codes (te abstract voor beginner).

## 2026-04-28, Cache-busting via no-store + URL timestamp + clear-all knop
**What was decided:** HTML responses sturen `Cache-Control: no-store, no-cache, must-revalidate` + `Pragma: no-cache`. Profile heeft "Force Update Now" (unregisters SW + clears Cache Storage + reload met `?_t=`) en "Clear All Cached Data" (wipe IndexedDB/localStorage/sessionStorage too).
**Why:** iOS Safari PWA caching is brutaal. `no-cache` alleen werd genegeerd, gebruikers bleven op v1.0 hangen. Drie defenses gestapeld werkt eindelijk.
**What was rejected:** Service worker met network-first strategy (te complex voor MVP, kan zelf weer cache-issues maken); query string op asset URLs (assets hebben al hashed filenames, niet de bottleneck).
