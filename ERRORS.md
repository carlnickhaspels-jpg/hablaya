# HablaYa — Errors & Lessons

## VAD (Voice Activity Detection) op web
**What didn't work:**
- RMS-based VAD met simpele threshold (0.025): false positives bij achtergrondgeluid
- Threshold verhogen naar 0.035 + minSpeechMs naar 900ms: nog steeds flickeren tussen states
- Cool-down 1.5s na resume met threshold ×2.5: blokkeerde normale gebruikersstem
- Cool-down 0.6s met threshold ×1.4 + AudioContext auto-resume: nog niet betrouwbaar
- Debounce van speech-start UI: maskeerde het probleem maar fixte het niet

**What worked:**
Volledig schrappen van VAD. Tap-to-toggle (1 tik start, 1 tik stop) met "awaiting reply" pulse na AI-antwoord. Gebruiker heeft volledige controle, geen automagische detectie.

**Note for next time:** Voor mobiele browsers — accept dat VAD onbetrouwbaar is. iOS Safari pauseert AudioContext na elke media playback, echo cancellation lekt TTS terug. Push-to-talk of tap-to-toggle is de enige betrouwbare optie zonder native APIs.

---

## iOS PWA cache-busting
**What didn't work:**
- `Cache-Control: no-cache` op HTML: iOS Safari serveerde alsnog stale HTML
- Standaard `window.location.reload(true)`: niet aggressief genoeg, iOS pakte cached URL
- `npx expo export` met asset hashes alleen: HTML werd alsnog gecached, dus oude bundle URL bleef referenced

**What worked:**
Drie verdedigingen tegelijk:
1. Server: `Cache-Control: no-store, no-cache, must-revalidate` + `Pragma: no-cache` + `Expires: 0`
2. Update-knop: unregisters service workers + clears Cache Storage API + `location.replace(url + '?_t=' + Date.now())`
3. Nuclear knop: bovenstaande + wipe localStorage/sessionStorage/IndexedDB

**Note for next time:** Voor PWAs op iOS, plan vanaf dag 1 voor cache-issues. Bouw "Force Update" en "Clear All Cached Data" knoppen in vóór je gebruikers hebt. Ingebouwde versie-check (`/api/version` vs `CLIENT_BUILD_AT`) met visible "Update available" banner is essentieel.

---

## OpenAI TTS latency
**What didn't work:**
- `gpt-4o-mini-tts` model: 3-5 sec wachttijd per AI-antwoord, voelde gebroken
- Audio downloaden als Blob dan `URL.createObjectURL` + `new Audio(url)`: extra 200-500ms wachttijd voor full download

**What worked:**
- Model swap naar `tts-1` (5-10x sneller, kwaliteit nog steeds goed)
- GET endpoint variant `/api/tts?text=...` zodat `<audio src=…>` direct kan streamen — playback start bij eerste bytes

**Note for next time:** Voor real-time conversational AI, gebruik altijd `tts-1` of een streamable TTS. De kwaliteit van `gpt-4o-mini-tts` is mooier maar de latency-cost is niet waard. Voor language-mixing (Dutch + Spaans in één zin) is OpenAI nova voice native multilingual.

---

## Whisper hallucinaties op stilte
**What didn't work:**
Whisper transcribeert stilte/korte ruis als "Goodbye", "Thank you", "Bye", "Gracias", "Music", "Subtítulos por...", "...". Deze werden naar de tutor gestuurd → AI nam afscheid → conversatie eindigde uit het niets.

**What worked:**
Server-side filter: array van 30+ bekende hallucinatie-frases, lowercase exact-match check op response. Plus `wordCount <= 2 && length < 15` heuristiek voor korte transcripties die hallucinatie-woorden bevatten. Plus client minSpeechMs van 900ms (toen we nog VAD hadden) en MediaRecorder data-size check >1KB.

**Note for next time:** Wanneer je Whisper bouwt voor short-utterance use case, log altijd raw transcripties eerst. De hallucinaties zijn voorspelbaar en consistent — filter ze server-side. `verbose_json` response_format geeft `avg_logprob` per segment wat extra signal is voor onzekere/verkeerd uitgesproken woorden.

---

## React Native Web Alert.alert
**What didn't work:**
`Alert.alert("Title", "Message", [{ text: "Cancel" }, { text: "OK", onPress: ... }])` — werkt op iOS/Android native maar **doet niks op web** voor multi-button alerts. Gebruiker tikt "Retake Speaking" → niets gebeurt. Geen error, geen log, gewoon stil.

**What worked:**
Eigen `PickerModal.tsx` (scrollbare optie-lijst met selectie) en `ConfirmModal.tsx` (titel + message + 2 knoppen) met React Native `Modal` component. Werkt identiek op web + native.

**Note for next time:** Voor cross-platform RN apps die ook op web draaien: gebruik nooit `Alert.alert` voor multi-button. Bouw je eigen Modal-componenten vanaf het begin. Single-button OK alerts werken via `window.alert` polyfill, multi-button niet.

---

## JSX unicode escape sequences
**What didn't work:**
`<Text>¡Hola, {userName}!</Text>` — JSX text content evalueert escape sequences NIET. Renderde letterlijk "¡Hola, Carl" op het scherm. Gebruiker dacht dat het een charset/encoding probleem was, maar het was JSX.

**What worked:**
Wrap in template literal expression: `<Text>{`¡Hola, ${userName}!`}</Text>`. Of gebruik direct het karakter ¡ in de source. JS string literals (tussen quotes) evalueren escape sequences wél, dus `'¡Hola'` in een variabele werkt prima.

**Note for next time:** In JSX gebruik altijd echte unicode karakters (¡ ¿ á é í ñ) in source files. Of als je escape sequences moet houden, wrap met `{`...`}`. UTF-8 source files zijn standaard in alle editors die we gebruiken — geen reden om te escapen.

---

## Railway PWA distribution vs native iOS app
**What didn't work:**
- Eerste poging via `npx expo start --web` lokaal: werkte op laptop maar liet zien dat we Railway-style hosting nodig hadden
- Static export naar `dist/` + `serve` package: werkte voor eerste demo maar miste API endpoints voor speech/auth

**What worked:**
Eigen Node `server.js` die `dist/` static serveert + alle `/api/*` routes hostet. Eén Railway service, één deploy, geen CORS issues (zelfde origin). PWA via Safari "Add to Home Screen" — geen App Store nodig.

**Note for next time:** Voor MVPs van consumer-facing apps: PWA-first is sneller dan native iOS. Geen €99/jaar fee, geen review wait, updates direct live. Native komt pas in beeld als je écht offline support of native APIs nodig hebt.
