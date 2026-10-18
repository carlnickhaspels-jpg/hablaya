"""Tests zonder netwerk: metadata, instructies, opschonen, afvalfilter, teller en config."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest
from livekit.agents.llm import ChatContext, ChatMessage

from hablaya_voice_agent.agent import (
    INSTRUCTIONS_MESSAGE_ID,
    clean_tts_stream,
    clean_tts_text,
    count_consecutive_questions,
    is_junk_transcript,
    with_question_counter,
)
from hablaya_voice_agent.config import VoiceConfig
from hablaya_voice_agent.tutor_prompt import (
    LESSON_MODE_PROMPT,
    TUTOR_SYSTEM_PROMPT,
    Scenario,
    TutorMetadata,
    build_instructions,
    parse_metadata,
)

SCENARIO = {
    "id": "cafe",
    "title": "At the cafe",
    "titleEs": "En el cafe",
    "context": "You order coffee.",
    "theme": "daily",
}


# ── parse_metadata ────────────────────────────────────────────────────────────────────────
def test_parse_metadata_valid():
    raw = json.dumps(
        {"level": "fluido", "scenario": SCENARIO, "greeting": "Hola", "userName": "Carl"}
    )
    meta = parse_metadata(raw)
    assert meta.level == "fluido"
    assert meta.scenario == Scenario("cafe", "At the cafe", "En el cafe", "You order coffee.", "daily")
    assert meta.greeting == "Hola"
    assert meta.user_name == "Carl"


@pytest.mark.parametrize("raw", ["", "   ", "{", "not json", "[]", "null", "42"])
def test_parse_metadata_invalid_gives_defaults(raw):
    assert parse_metadata(raw) == TutorMetadata()
    meta = parse_metadata(raw)
    assert (meta.level, meta.scenario, meta.greeting, meta.user_name) == (
        "principiante",
        None,
        "",
        "",
    )


def test_parse_metadata_missing_and_wrong_fields():
    meta = parse_metadata(json.dumps({"level": "bogus", "scenario": "x", "greeting": 5}))
    assert meta == TutorMetadata()
    assert parse_metadata(json.dumps({"scenario": {}})).scenario is None
    partial = parse_metadata(json.dumps({"scenario": {"title": "T"}})).scenario
    assert partial == Scenario(title="T")


# ── build_instructions ────────────────────────────────────────────────────────────────────
def test_instructions_contain_prompt_and_level():
    text = build_instructions(parse_metadata(json.dumps({"level": "silencioso"})))
    assert text.startswith(TUTOR_SYSTEM_PROMPT)
    assert "STUDENT LEVEL: silencioso" in text
    assert "CURRENT SCENARIO" not in text


def test_instructions_include_scenario():
    text = build_instructions(parse_metadata(json.dumps({"scenario": SCENARIO})))
    assert "CURRENT SCENARIO: At the cafe (En el cafe)" in text
    assert "SCENARIO CONTEXT: You order coffee." in text
    assert "Stay in character for this scenario." in text
    assert LESSON_MODE_PROMPT not in text


def test_lesson_mode_only_for_lesson_theme():
    lesson = {**SCENARIO, "theme": "lesson"}
    with_lesson = build_instructions(parse_metadata(json.dumps({"scenario": lesson})))
    assert "LESSON MODE — ACTIVE" in with_lesson
    assert LESSON_MODE_PROMPT in with_lesson
    without = build_instructions(parse_metadata(json.dumps({"scenario": SCENARIO})))
    assert "LESSON MODE" not in without
    assert "LESSON MODE" not in build_instructions(TutorMetadata())


def test_prompts_are_verbatim_copies_of_server_js():
    server_js = Path(__file__).resolve().parents[2] / "server.js"
    if not server_js.exists():
        pytest.skip("server.js niet beschikbaar (alleen voice-agent/ aanwezig)")
    src = server_js.read_text(encoding="utf-8").replace("\r\n", "\n")
    assert f"const TUTOR_SYSTEM_PROMPT = `{TUTOR_SYSTEM_PROMPT}`;" in src
    assert f"systemPrompt += `\n\n{LESSON_MODE_PROMPT}`;" in src


# ── opschonen voor de stem ────────────────────────────────────────────────────────────────
def test_clean_tts_text():
    raw = "Je bedoelt: '¡Quiero ir!' 👇\n**vet** en *schuin* en `code` → klaar ↑ ↓ 🎉"
    cleaned = clean_tts_text(raw)
    assert "👇" not in cleaned and "🎉" not in cleaned
    assert "→" not in cleaned and "↑" not in cleaned and "↓" not in cleaned
    assert "*" not in cleaned and "`" not in cleaned
    assert "vet en schuin en code" in cleaned
    assert "¡Quiero ir!" in cleaned


def test_clean_tts_stream_handles_markdown_across_chunks():
    async def chunks():
        for piece in ["Hola ", "**Je be", "doelt:** ", "dat is ", "`gra", "cias` 🎉 ", "ok"]:
            yield piece

    async def collect():
        return "".join([p async for p in clean_tts_stream(chunks())])

    out = asyncio.run(collect())
    assert "*" not in out and "`" not in out and "🎉" not in out
    assert out.replace("  ", " ").strip() == "Hola Je bedoelt: dat is gracias ok"


# ── afvalfilter ───────────────────────────────────────────────────────────────────────────
@pytest.mark.parametrize(
    "text",
    ["Thank you for watching!", "Subtitles by the Amara community", "Música", "[Music]", "", "..."],
)
def test_junk_is_filtered(text):
    assert is_junk_transcript(text)


@pytest.mark.parametrize("text", ["Hola", "Gracias", "Sí", "vale", "Me llamo Carlos", "okay"])
def test_real_speech_passes(text):
    assert not is_junk_transcript(text)


# ── teller ────────────────────────────────────────────────────────────────────────────────
def test_count_consecutive_questions():
    assert count_consecutive_questions([]) == 0
    assert count_consecutive_questions(["Hola.", "¿Qué tal?", "¿Y tú? "]) == 2
    assert count_consecutive_questions(["¿Qué?", "Muy bien."]) == 0


def test_with_question_counter_updates_only_the_copy():
    ctx = ChatContext()
    ctx.items.append(
        ChatMessage(id=INSTRUCTIONS_MESSAGE_ID, role="system", content=["BASE"])
    )
    ctx.add_message(role="assistant", content="¿Cómo te llamas?")
    ctx.add_message(role="user", content="Carlos")
    ctx.add_message(role="assistant", content="¿De dónde eres?")
    ctx.add_message(role="user", content="Holanda")

    out = with_question_counter(ctx)
    assert out.items[0].text_content == "BASE\n\nQUESTIONS ASKED IN A ROW: 2"
    assert ctx.items[0].text_content == "BASE"


# ── config ────────────────────────────────────────────────────────────────────────────────
def test_config_defaults(monkeypatch):
    for name in VoiceConfig.model_fields:
        monkeypatch.delenv(name, raising=False)
    cfg = VoiceConfig()
    assert cfg.VOICE_STT == "openai"
    assert cfg.VOICE_STT_TAAL == "es"
    assert cfg.VOICE_STT_EXTRA_TALEN == "nl"
    assert cfg.VOICE_STT_STILTE_SECONDEN == 1.0
    assert cfg.VOICE_TTS == "elevenlabs"
    assert cfg.VOICE_TTS_ELEVENLABS_MODEL == "eleven_v4_turbo"
    assert cfg.VOICE_TTS_ELEVENLABS_FORMAAT == "pcm_24000"
    assert cfg.VOICE_LLM_MODEL == "gpt-4o-mini"
    assert cfg.VOICE_LLM_TEMPERATURE == 0.8
    assert cfg.VOICE_LLM_MAX_TOKENS == 250
    assert cfg.VOICE_ONDERBREEK_WOORDEN == 2
    assert cfg.VOICE_ONDERBREEK_SECONDEN == 0.8
    assert cfg.VOICE_ONDERBREEK_HERSTEL_SECONDEN == 2.0
    assert cfg.VOICE_ONDERBREEK_MODUS == ""
    assert cfg.OPENAI_API_KEY.get_secret_value() == ""
    assert cfg.ELEVENLABS_VOICE_ID == ""


def test_select_stt_spanish_with_dutch(monkeypatch):
    from livekit.plugins import elevenlabs

    from hablaya_voice_agent.pipeline import select_stt

    seen: dict = {}

    def fake_stt(**kwargs):
        seen.update(kwargs)
        return "stt"

    monkeypatch.setattr(elevenlabs, "STT", fake_stt)
    for name in VoiceConfig.model_fields:
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("ELEVENLABS_API_KEY", "test")
    monkeypatch.setenv("VOICE_STT", "elevenlabs")  # niet meer de standaard, wel nog ondersteund

    select_stt(VoiceConfig())
    assert seen["language_code"] == "es"
    assert seen["secondary_languages"] == ["nl"]
    # zonder server-VAD komt er nooit een definitieve zin (commit_strategy=manual)
    assert seen["server_vad"] == {"vad_silence_threshold_secs": 1.0}

    seen.clear()
    monkeypatch.setenv("VOICE_STT_TAAL", "auto")
    select_stt(VoiceConfig())
    assert "language_code" not in seen and "secondary_languages" not in seen


def test_config_reads_env(monkeypatch):
    monkeypatch.setenv("VOICE_LLM_MAX_TOKENS", "100")
    monkeypatch.setenv("VOICE_ONDERBREEK_WOORDEN", "")  # leeg = standaard
    cfg = VoiceConfig()
    assert cfg.VOICE_LLM_MAX_TOKENS == 100
    assert cfg.VOICE_ONDERBREEK_WOORDEN == 2


def test_select_tts_elevenlabs_uses_pcm_24000(monkeypatch):
    from livekit.plugins import elevenlabs

    from hablaya_voice_agent.pipeline import select_tts

    seen: dict = {}

    class FakeTTS:
        def __init__(self, **kwargs):
            seen.update(kwargs)

    monkeypatch.setattr(elevenlabs, "TTS", FakeTTS)
    for name in VoiceConfig.model_fields:
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("ELEVENLABS_API_KEY", "test")
    monkeypatch.setenv("ELEVENLABS_VOICE_ID", "voice")
    monkeypatch.setenv("OPENAI_API_KEY", "test")
    try:
        select_tts(VoiceConfig())
    except Exception:
        pass  # de FallbackAdapter mag over de nep-TTS vallen; het gaat om de meegegeven opties
    # mp3_22050_32 (plugin-standaard) gaf kraakjes; pcm_24000 voorkomt inpakken en omrekenen
    assert seen.get("encoding") == "pcm_24000"


# ── tutorkeuze en correctie-intensiteit ───────────────────────────────────────────────────
def test_parse_metadata_tutor_and_correction_defaults():
    meta = parse_metadata(json.dumps({"level": "fluido"}))
    assert (meta.tutor, meta.correction) == ("carlos", "important")
    assert parse_metadata("") == TutorMetadata()
    assert TutorMetadata().tutor == "carlos" and TutorMetadata().correction == "important"
    bogus = parse_metadata(json.dumps({"tutor": "pedro", "correction": "strict"}))
    assert (bogus.tutor, bogus.correction) == ("carlos", "important")
    wrong_type = parse_metadata(json.dumps({"tutor": 5, "correction": ["all"]}))
    assert (wrong_type.tutor, wrong_type.correction) == ("carlos", "important")


@pytest.mark.parametrize("tutor", ["carlos", "maria"])
@pytest.mark.parametrize("correction", ["all", "important", "flow"])
def test_parse_metadata_tutor_and_correction_values(tutor, correction):
    meta = parse_metadata(json.dumps({"tutor": tutor, "correction": correction}))
    assert (meta.tutor, meta.correction) == (tutor, correction)


def test_instructions_persona_carlos_and_maria():
    carlos = build_instructions(parse_metadata(json.dumps({"tutor": "carlos"})))
    assert carlos.startswith(TUTOR_SYSTEM_PROMPT)
    assert "Your name is Carlos and you are a man" in carlos
    assert "profesor" in carlos and "encantado" in carlos and "leraar" in carlos
    assert "profesora" not in carlos and "lerares" not in carlos

    maria = build_instructions(parse_metadata(json.dumps({"tutor": "maria"})))
    assert maria.startswith(TUTOR_SYSTEM_PROMPT)
    assert "Your name is María and you are a woman" in maria
    assert "profesora" in maria and "encantada" in maria and "lerares" in maria
    assert "Your name is Carlos" not in maria


def test_instructions_correction_block_per_setting():
    def build(correction):
        return build_instructions(parse_metadata(json.dumps({"correction": correction})))

    all_text, important, flow = build("all"), build("important"), build("flow")
    assert "CORRECTION INTENSITY: ALL ERRORS" in all_text
    assert "CORRECTION INTENSITY: IMPORTANT ONLY" in important
    assert "high-frequency beginner errors" in important
    assert "CORRECTION INTENSITY: FLOW MODE" in flow
    assert "recast the correct form" in flow
    for text, others in ((all_text, ("IMPORTANT ONLY", "FLOW MODE")),
                         (important, ("ALL ERRORS", "FLOW MODE")),
                         (flow, ("ALL ERRORS", "IMPORTANT ONLY"))):
        assert all(f"CORRECTION INTENSITY: {o}" not in text for o in others)
    # zonder correctie in de metadata geldt "important"
    assert "IMPORTANT ONLY" in build_instructions(TutorMetadata())


def test_lesson_mode_name_follows_tutor():
    lesson = {**SCENARIO, "theme": "lesson"}
    carlos = build_instructions(parse_metadata(json.dumps({"scenario": lesson, "tutor": "carlos"})))
    assert LESSON_MODE_PROMPT in carlos  # Carlos: woordelijk de constante
    maria = build_instructions(parse_metadata(json.dumps({"scenario": lesson, "tutor": "maria"})))
    assert "You are MARÍA, a cheerful and patient Spanish teacher." in maria
    assert "Each María-turn" in maria
    assert "You are CARLOS" not in maria and "Carlos-turn" not in maria
    # de rest van de lesprompt blijft ongewijzigd
    assert (
        LESSON_MODE_PROMPT.replace("You are CARLOS", "You are MARÍA").replace(
            "Each Carlos-turn", "Each María-turn"
        )
        in maria
    )


def _patch_elevenlabs_and_openai(monkeypatch, seen: dict):
    from livekit.plugins import elevenlabs, openai

    class FakeEleven:
        def __init__(self, **kwargs):
            seen["eleven"] = kwargs

    class FakeOpenAI:
        def __init__(self, **kwargs):
            seen["openai"] = kwargs

    monkeypatch.setattr(elevenlabs, "TTS", FakeEleven)
    monkeypatch.setattr(openai, "TTS", FakeOpenAI)
    for name in VoiceConfig.model_fields:
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("ELEVENLABS_API_KEY", "test")
    monkeypatch.setenv("OPENAI_API_KEY", "test")


def _select_tts_quietly(tutor):
    from hablaya_voice_agent.pipeline import select_tts

    try:
        select_tts(VoiceConfig(), tutor)
    except Exception:
        pass  # de FallbackAdapter mag over de nep-TTS vallen; het gaat om de meegegeven opties


def test_select_tts_voice_per_tutor(monkeypatch):
    seen: dict = {}
    _patch_elevenlabs_and_openai(monkeypatch, seen)
    monkeypatch.setenv("ELEVENLABS_VOICE_ID", "carlos-voice")
    monkeypatch.setenv("ELEVENLABS_VOICE_ID_MARIA", "maria-voice")

    _select_tts_quietly("carlos")
    assert seen["eleven"]["voice_id"] == "carlos-voice"
    assert seen["eleven"]["encoding"] == "pcm_24000"

    seen.clear()
    _select_tts_quietly("maria")
    assert seen["eleven"]["voice_id"] == "maria-voice"
    assert seen["eleven"]["encoding"] == "pcm_24000"
    assert seen["openai"]["voice"] == "nova"  # vangnet blijft achter ElevenLabs


def test_select_tts_default_tutor_is_carlos(monkeypatch):
    from hablaya_voice_agent.pipeline import select_tts

    seen: dict = {}
    _patch_elevenlabs_and_openai(monkeypatch, seen)
    monkeypatch.setenv("ELEVENLABS_VOICE_ID", "carlos-voice")
    monkeypatch.setenv("ELEVENLABS_VOICE_ID_MARIA", "maria-voice")
    try:
        select_tts(VoiceConfig())
    except Exception:
        pass
    assert seen["eleven"]["voice_id"] == "carlos-voice"


def test_select_tts_maria_without_voice_id_uses_female_openai(monkeypatch, caplog):
    seen: dict = {}
    _patch_elevenlabs_and_openai(monkeypatch, seen)
    monkeypatch.setenv("ELEVENLABS_VOICE_ID", "carlos-voice")  # alleen Carlos heeft een stem

    with caplog.at_level("WARNING", logger="hablaya.voice.pipeline"):
        _select_tts_quietly("maria")
    assert "eleven" not in seen  # nooit de mannenstem van Carlos voor María
    assert seen["openai"]["voice"] == "nova"
    assert "ELEVENLABS_VOICE_ID_MARIA" in caplog.text

    seen.clear()
    _select_tts_quietly("carlos")  # Carlos blijft zijn eigen stem houden
    assert seen["eleven"]["voice_id"] == "carlos-voice"


def test_config_maria_voice_defaults_to_empty(monkeypatch):
    for name in VoiceConfig.model_fields:
        monkeypatch.delenv(name, raising=False)
    assert VoiceConfig().ELEVENLABS_VOICE_ID_MARIA == ""
