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

    # Spraakherkenning: elevenlabs (Scribe v2 realtime, streamend) | openai (gpt-4o-transcribe,
    # achter de VAD). Ontbreekt de ElevenLabs-sleutel, dan valt de agent terug op openai.
    VOICE_STT: str = "elevenlabs"
    # `auto` = de herkenner bepaalt de taal zelf per uiting. De ElevenLabs-plugin (1.8.4) ondersteunt
    # dat (zonder `language_code` staat `include_language_detection` aan). Gekozen omdat de leerling
    # Spaans praat maar ook Nederlandse of Engelse woorden gebruikt, en de tutor die moet horen
    # ("Je bedoelt..."). Een vaste taalcode (bv. `es`) dwingt alles naar Spaanse woorden.
    VOICE_STT_TAAL: str = "auto"

    # Stem: elevenlabs | openai. Zonder ElevenLabs-sleutel of ELEVENLABS_VOICE_ID wordt het openai.
    VOICE_TTS: str = "elevenlabs"
    VOICE_TTS_ELEVENLABS_MODEL: str = "eleven_v4_turbo"

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
