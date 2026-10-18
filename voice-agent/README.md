# hablaya-voice-agent

Spraakwerker voor de HablaYa-tutor (proof of concept), gebouwd op LiveKit Agents 1.8.4 en
overgenomen uit de bewezen Falcon-agent, zonder alles wat Falcon-specifiek is. De leerling
praat Spaans; de tutor antwoordt in het Spaans en corrigeert en legt uit in het Nederlands.
Het gedrag van de tutor (prompt, niveau, scenario, lesmodus) komt uit `server.js`.

Keten: spraakherkenning (ElevenLabs, vangnet OpenAI) -> taalmodel (OpenAI gpt-4o-mini)
-> stem (ElevenLabs, vangnet OpenAI tts-1 "nova").

## Waarschuwing: gebruik een apart LiveKit Cloud-project

Maak voor HablaYa een EIGEN LiveKit Cloud-project aan en gebruik dus andere
`LIVEKIT_*`-waarden dan Falcon. De Falcon-werker neemt namelijk deel aan elke ruimte in zijn
project. Delen beide dezelfde LiveKit-sleutels, dan springt de Falcon-agent in de gesprekken
van HablaYa. Deze werker registreert zich als `hablaya-tutor` en doet alleen mee wanneer de
server dat per ruimte expliciet vraagt.

## Omgevingsvariabelen (alleen namen)

Verplicht: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` (leest LiveKit zelf),
`OPENAI_API_KEY`.

Voor de ElevenLabs-stem en -herkenning: `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`.
Ontbreekt een van de twee, dan gebruikt de werker OpenAI (met een waarschuwing in het log).

Keuzes (met standaardwaarde): `VOICE_STT` (`elevenlabs`), `VOICE_STT_TAAL` (`auto`),
`VOICE_TTS` (`elevenlabs`), `VOICE_TTS_ELEVENLABS_MODEL` (`eleven_v4_turbo`),
`VOICE_LLM_MODEL` (`gpt-4o-mini`), `VOICE_LLM_TEMPERATURE` (`0.8`), `VOICE_LLM_MAX_TOKENS` (`250`),
`VOICE_ONDERBREEK_WOORDEN` (`2`), `VOICE_ONDERBREEK_SECONDEN` (`0.8`),
`VOICE_ONDERBREEK_HERSTEL_SECONDEN` (`2.0`), `VOICE_ONDERBREEK_MODUS` (leeg), `PORT` (`8081`).

`VOICE_STT_TAAL=auto`: de ElevenLabs-herkenner bepaalt de taal zelf, omdat de leerling soms
Nederlandse of Engelse woorden gebruikt en de tutor die moet horen. Een vaste taalcode
(bijvoorbeeld `es`) is mogelijk, maar dwingt alles naar Spaanse woorden.

## Lokaal draaien

Vereist: Python 3.12 en `uv`. Alle commando's in `voice-agent/`.

```
uv sync
uv run pytest -q
uv run python -m hablaya_voice_agent.main dev
```

Zet daarvoor de variabelen hierboven in de shell (nooit in git). De werker meldt zich bij
LiveKit en wacht op een expliciete dispatch voor `hablaya-tutor`; de token-endpoint van
HablaYa (`POST /api/livekit/token`) zorgt daarvoor.

## Railway

Maak een APARTE Railway-service naast de bestaande HablaYa-service:

- Root directory: `voice-agent/` (de Dockerfile en `railway.json` staan daar).
- Zet de omgevingsvariabelen hierboven in de service.
- Geen healthcheck: de werker verbindt alleen uitgaand met LiveKit Cloud.

## Bekende beperkingen

- De teller "QUESTIONS ASKED IN A ROW" is wel overgenomen (per beurt aan de instructie
  toegevoegd). Niet overgenomen zijn de delen van `handleTutor` die van Whisper afhangen:
  de uitspraaktip op basis van onzekere segmenten en de melding "LANGUAGE DETECTED". Ook de
  "ambiguous fillers" van `handleTranscribe` (afhankelijk van `avg_logprob`) ontbreken; alleen
  de zekere afvalzinnen worden weggefilterd.
- Het beurtwisselmodel (`inference.TurnDetector`, lokaal `v1-mini`) kent Spaans, Nederlands en
  Engels. Mocht het laden mislukken, dan beslist de stilte (VAD).
- Niet getest met echte sleutels of een echt gesprek; de tests draaien zonder netwerk.
