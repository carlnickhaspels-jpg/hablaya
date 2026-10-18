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
    assert cfg.VOICE_STT == "elevenlabs"
    assert cfg.VOICE_STT_TAAL == "es"
    assert cfg.VOICE_STT_EXTRA_TALEN == "nl"
    assert cfg.VOICE_TTS == "elevenlabs"
    assert cfg.VOICE_TTS_ELEVENLABS_MODEL == "eleven_v4_turbo"
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

    select_stt(VoiceConfig())
    assert seen["language_code"] == "es"
    assert seen["secondary_languages"] == ["nl"]

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
