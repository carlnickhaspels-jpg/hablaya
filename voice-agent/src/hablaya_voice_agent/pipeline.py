"""Opbouw van de spraaksessie op LiveKit Agents 1.x (afgeleid van de Falcon-agent).

Elke keuze (herkenner, brein, stem) staat in een eigen `select_*`-functie, zodat ze los van de
LiveKit-runtime te testen zijn. Plugins worden pas bij gebruik geimporteerd.
"""

from __future__ import annotations

import importlib
import logging
from typing import TYPE_CHECKING, Any

from hablaya_voice_agent.config import VoiceConfig

if TYPE_CHECKING:
    from livekit.agents import llm as lk_llm
    from livekit.agents import stt as lk_stt
    from livekit.agents import tts as lk_tts

log = logging.getLogger("hablaya.voice.pipeline")

OPENAI_STT_MODEL = "gpt-4o-transcribe"
OPENAI_TTS_MODEL = "tts-1"
OPENAI_TTS_VOICE = "nova"


def load_plugins() -> None:
    """Importeer de plugins alvast (in `prewarm`, buiten een gesprek).

    Een import blokkeert de event loop (~100 ms per plugin); in het eerste antwoord hoor je dat
    als haperen.
    """
    for name in ("openai", "elevenlabs"):
        try:
            importlib.import_module(f"livekit.plugins.{name}")
        except ImportError:
            log.warning("plugin_not_loaded plugin=%s", name)


def select_stt(cfg: VoiceConfig) -> lk_stt.STT:
    """Kies de spraakherkenner met `VOICE_STT`.

    - `openai` (standaard): gpt-4o-transcribe; niet streamend, daarom zet LiveKit er de VAD voor.
    - `elevenlabs`: Scribe v2 realtime, streamend. Taal volgens `VOICE_STT_TAAL`.

    Ontbreekt de ElevenLabs-sleutel, dan volgt OpenAI (met een waarschuwing).
    """
    choice = cfg.VOICE_STT.strip().lower() or "openai"
    language = cfg.VOICE_STT_TAAL.strip().lower() or "auto"
    eleven_key = cfg.ELEVENLABS_API_KEY.get_secret_value()
    openai_key = cfg.OPENAI_API_KEY.get_secret_value()

    if choice not in ("elevenlabs", "openai"):
        raise ValueError(f"onbekende VOICE_STT {cfg.VOICE_STT!r} (elevenlabs | openai)")

    if choice == "elevenlabs" and not eleven_key:
        if not openai_key:
            raise ValueError("geen spraakherkenning beschikbaar: zet ELEVENLABS_API_KEY of OPENAI_API_KEY")
        log.warning("select_stt: ELEVENLABS_API_KEY ontbreekt, OpenAI-herkenning wordt gebruikt")
        choice = "openai"

    if choice == "elevenlabs":
        from livekit.plugins import elevenlabs  # noqa: PLC0415

        kwargs: dict[str, Any] = {}
        extra: list[str] = []
        if language != "auto":
            kwargs["language_code"] = language
            extra = [
                t.strip().lower()
                for t in cfg.VOICE_STT_EXTRA_TALEN.split(",")
                if t.strip() and t.strip().lower() != language
            ]
            if extra:
                kwargs["secondary_languages"] = extra
        kwargs["server_vad"] = {"vad_silence_threshold_secs": cfg.VOICE_STT_STILTE_SECONDEN}
        log.info(
            "select_stt provider=elevenlabs language=%s extra=%s stilte_s=%s",
            language,
            ",".join(extra) or "-",
            cfg.VOICE_STT_STILTE_SECONDEN,
        )
        return elevenlabs.STT(model="scribe_v2_realtime", api_key=eleven_key, **kwargs)

    if not openai_key:
        raise ValueError("VOICE_STT=openai vraagt om OPENAI_API_KEY")
    from livekit.plugins import openai  # noqa: PLC0415

    log.info("select_stt provider=openai language=%s", language)
    if language == "auto":
        return openai.STT(model=OPENAI_STT_MODEL, detect_language=True, api_key=openai_key)
    return openai.STT(model=OPENAI_STT_MODEL, language=language, api_key=openai_key)


def select_llm(cfg: VoiceConfig) -> lk_llm.LLM:
    """Het taalmodel: OpenAI (standaard gpt-4o-mini), zoals de bestaande tutor."""
    openai_key = cfg.OPENAI_API_KEY.get_secret_value()
    if not openai_key:
        raise ValueError("het taalmodel vraagt om OPENAI_API_KEY")
    from livekit.plugins import openai  # noqa: PLC0415

    log.info("select_llm provider=openai model=%s", cfg.VOICE_LLM_MODEL)
    return openai.LLM(
        model=cfg.VOICE_LLM_MODEL,
        temperature=cfg.VOICE_LLM_TEMPERATURE,
        max_completion_tokens=cfg.VOICE_LLM_MAX_TOKENS,
        api_key=openai_key,
    )


def select_tts(cfg: VoiceConfig) -> lk_tts.TTS:
    """Kies de stem met `VOICE_TTS`, met OpenAI als vangnet.

    Keten bij `elevenlabs`: ElevenLabs, dan OpenAI tts-1 (stem "nova"). Ontbreekt de
    ElevenLabs-sleutel of `ELEVENLABS_VOICE_ID`, dan blijft alleen OpenAI over (met een waarschuwing).
    """
    from livekit.agents import tts as lk_tts  # noqa: PLC0415

    choice = cfg.VOICE_TTS.strip().lower() or "elevenlabs"
    if choice not in ("elevenlabs", "openai"):
        raise ValueError(f"onbekende VOICE_TTS {cfg.VOICE_TTS!r} (elevenlabs | openai)")

    eleven_key = cfg.ELEVENLABS_API_KEY.get_secret_value()
    voice_id = cfg.ELEVENLABS_VOICE_ID.strip()
    openai_key = cfg.OPENAI_API_KEY.get_secret_value()

    chain: list[lk_tts.TTS] = []
    names: list[str] = []

    if choice == "elevenlabs":
        if eleven_key and voice_id:
            from livekit.plugins import elevenlabs  # noqa: PLC0415

            # Geen `language`: de tutor praat Spaans en legt in het Nederlands uit, door elkaar.
            chain.append(
                elevenlabs.TTS(
                    voice_id=voice_id,
                    model=cfg.VOICE_TTS_ELEVENLABS_MODEL,
                    api_key=eleven_key,
                    encoding=cfg.VOICE_TTS_ELEVENLABS_FORMAAT,
                )
            )
            names.append("elevenlabs")
        else:
            log.warning(
                "select_tts: ELEVENLABS_API_KEY of ELEVENLABS_VOICE_ID ontbreekt, OpenAI-stem wordt gebruikt"
            )

    if openai_key:
        from livekit.plugins import openai  # noqa: PLC0415

        chain.append(openai.TTS(model=OPENAI_TTS_MODEL, voice=OPENAI_TTS_VOICE, api_key=openai_key))
        names.append("openai")

    if not chain:
        raise ValueError("geen stem beschikbaar: zet OPENAI_API_KEY (en voor ElevenLabs ook de sleutel en stem-ID)")

    if len(chain) == 1:
        log.info("select_tts provider=%s", names[0])
        if names[0] == "elevenlabs":
            log.warning("select_tts: OPENAI_API_KEY ontbreekt, geen vangnet achter ElevenLabs")
        return chain[0]

    log.info("select_tts provider=fallback_%s", "_then_".join(names))
    # FallbackAdapter neemt sample_rate = max van de stemmen en schaalt de rest daarheen.
    return lk_tts.FallbackAdapter(chain)


def build_session(
    *,
    stt: lk_stt.STT,
    llm: lk_llm.LLM,
    tts: lk_tts.TTS,
    vad: Any,
    cfg: VoiceConfig,
) -> Any:
    """De AgentSession: beurtwisseling op betekenis, onderbreken toegestaan (zoals Falcon).

    Beurtwisseling: LiveKit's `inference.TurnDetector`. Het lokale model (`v1-mini`) kent
    Spaans (`es`), Nederlands (`nl`) en Engels (`en`); dat is gecontroleerd in
    `livekit/agents/inference/eot/languages.py` van de geinstalleerde versie. Lukt het laden
    toch niet, dan beslist de VAD (stilte) over het einde van de beurt.

    Onderbreken: de stem stopt pas als de leerling minstens `VOICE_ONDERBREEK_SECONDEN` praat
    EN de herkenner er al `VOICE_ONDERBREEK_WOORDEN` woorden van heeft. Een onderbreking waar
    binnen `VOICE_ONDERBREEK_HERSTEL_SECONDEN` geen woorden op volgen is vals: de stem hervat.
    """
    from livekit.agents import AgentSession, inference  # noqa: PLC0415

    interruption: dict[str, Any] = {
        "enabled": True,
        "min_duration": cfg.VOICE_ONDERBREEK_SECONDEN,
        "min_words": cfg.VOICE_ONDERBREEK_WOORDEN,
        "resume_false_interruption": True,
        "false_interruption_timeout": cfg.VOICE_ONDERBREEK_HERSTEL_SECONDEN,
    }
    mode = cfg.VOICE_ONDERBREEK_MODUS.strip().lower()
    if mode in ("vad", "adaptive"):
        interruption["mode"] = mode

    turn_detection: Any
    try:
        turn_detection = inference.TurnDetector()
    except Exception:
        log.warning("turn_detector_unavailable: VAD bepaalt het einde van de beurt", exc_info=True)
        turn_detection = "vad"

    return AgentSession(
        stt=stt,
        llm=llm,
        tts=tts,
        vad=vad,
        turn_handling={
            "turn_detection": turn_detection,
            "endpointing": {"min_delay": 0.3, "max_delay": 2.5},
            "interruption": interruption,
            "preemptive_generation": {"enabled": True},
        },
    )
