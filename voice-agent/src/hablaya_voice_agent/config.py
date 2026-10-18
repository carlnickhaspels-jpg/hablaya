"""Instellingen van de spraakagent, allemaal uit omgevingsvariabelen.

`LIVEKIT_URL`, `LIVEKIT_API_KEY` en `LIVEKIT_API_SECRET` leest LiveKit zelf; die staan hier niet.
Alles heeft een standaardwaarde, behalve de sleutels: zonder `OPENAI_API_KEY` kan de agent
geen gesprek voeren (het taalmodel en de vangnetten gebruiken die sleutel).
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class VoiceConfig(BaseSettings):
    # Een lege variabele telt als "niet gezet" (anders faalt bv. een lege VOICE_ONDERBREEK_WOORDEN).
    model_config = SettingsConfigDict(
        env_file=None, case_sensitive=True, extra="ignore", env_ignore_empty=True
    )

    # Sleutels en stem.
    OPENAI_API_KEY: SecretStr = SecretStr("")
    ELEVENLABS_API_KEY: SecretStr = SecretStr("")
    ELEVENLABS_VOICE_ID: str = ""

    # Spraakherkenning: openai (gpt-4o-transcribe, achter de VAD) | elevenlabs (Scribe v2 realtime).
    # Standaard openai: ElevenLabs Scribe gokte bij "auto" Bulgaars en vertaalde met Nederlands als
    # extra taal het Spaans van de leerling naar het Nederlands (iPhone-tests 2026-10-18). OpenAI
    # verstond Carl goed en snel genoeg (1,5-3,2 s per beurt met de ElevenLabs-stem).
    VOICE_STT: str = "openai"
    # Hoofdtaal van de herkenner. `auto` liet ElevenLabs zelf raden en gaf bij korte zinnen met een
    # Nederlands accent soms Bulgaars (iPhone-test 2026-10-18). Daarom vast Spaans, met de talen uit
    # VOICE_STT_EXTRA_TALEN erbij (ElevenLabs `secondary_languages`, alleen Scribe v2 realtime), zodat
    # Nederlandse woorden van de leerling ook verstaan worden ("Je bedoelt...").
    VOICE_STT_TAAL: str = "es"
    # Komma-gescheiden extra talen naast de hoofdtaal. Geldt alleen voor ElevenLabs en niet bij `auto`.
    VOICE_STT_EXTRA_TALEN: str = "nl"
    # Seconden stilte waarna ElevenLabs een zin zelf definitief maakt (server-VAD, commit_strategy=vad).
    # Zonder server-VAD rondt de plugin alleen af op een expliciete flush, en die komt in deze opzet niet:
    # dan blijft elke zin "tussentijds" en antwoordt de tutor nooit (iPhone-test 2026-10-18).
    VOICE_STT_STILTE_SECONDEN: float = 1.0

    # Stem: elevenlabs | openai. Zonder ElevenLabs-sleutel of ELEVENLABS_VOICE_ID wordt het openai.
    VOICE_TTS: str = "elevenlabs"
    VOICE_TTS_ELEVENLABS_MODEL: str = "eleven_v4_turbo"
    # Geluidsformaat van de ElevenLabs-stem. De plugin-standaard mp3_22050_32 (32 kbps mp3, daarna
    # omgerekend naar 24 kHz) gaf hoorbare kraakjes; pcm_24000 is onverpakt en sluit aan op de
    # 24 kHz van het OpenAI-vangnet, dus geen omrekening.
    VOICE_TTS_ELEVENLABS_FORMAAT: str = "pcm_24000"

    # Taalmodel (OpenAI).
    VOICE_LLM_MODEL: str = "gpt-4o-mini"
    VOICE_LLM_TEMPERATURE: float = 0.8
    VOICE_LLM_MAX_TOKENS: int = 250

    # Onderbreken: de stem stopt pas bij echte woorden van de leerling. Geluid zonder
    # transcript (echo, ruis, een kuch) kapt het antwoord niet af.
    VOICE_ONDERBREEK_WOORDEN: int = 2
    VOICE_ONDERBREEK_SECONDEN: float = 0.8
    # Na een onderbreking zonder woorden binnen zoveel seconden hervat de stem.
    VOICE_ONDERBREEK_HERSTEL_SECONDEN: float = 2.0
    # leeg = automatisch | vad | adaptive (ML via LiveKit Inference)
    VOICE_ONDERBREEK_MODUS: str = ""

    # Railway zet PORT; de HTTP-server van de worker luistert daarop.
    PORT: int = 8081


@lru_cache(maxsize=1)
def get_voice_config() -> VoiceConfig:
    return VoiceConfig()
