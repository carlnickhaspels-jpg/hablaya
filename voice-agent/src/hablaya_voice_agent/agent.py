"""De agent: de HablaYa-tutor als LiveKit `Agent`.

Drie aanpassingen op de standaardagent, alle via hooks van livekit-agents 1.8.4:

- `tts_node`: tekst die naar de stem gaat wordt opgeschoond met dezelfde regels als `handleTTS`
  in `server.js` (emoji, pijlen, markdown, backticks). De tekst die naar de leerling gaat
  (`lk.transcription`) blijft ongemoeid, dus emoji blijven in het scherm staan.
- `on_user_turn_completed`: tekst die zeker geen echte spraak is (Whisper-achtige
  stiltehallucinaties) geeft `StopResponse`, zodat de tutor er niet op antwoordt.
- `llm_node`: de teller "QUESTIONS ASKED IN A ROW" wordt per beurt aan de instructie toegevoegd
  (zoals `handleTutor`). Op deze plek (en niet in `update_instructions`) blijft de preemptive
  generation geldig en groeit de chatgeschiedenis niet met configuratie-items.
"""

from __future__ import annotations

import logging
import re
from collections.abc import AsyncIterable, AsyncIterator, Iterable
from typing import TYPE_CHECKING

from livekit.agents import Agent, StopResponse
from livekit.agents.llm import ChatContext, ChatMessage

from hablaya_voice_agent.tutor_prompt import TutorMetadata, build_instructions

if TYPE_CHECKING:
    from livekit import rtc
    from livekit.agents import ModelSettings, llm

log = logging.getLogger("hablaya.voice.agent")

# Waarde van livekit.agents.voice.generation.INSTRUCTIONS_MESSAGE_ID ("value must not change").
INSTRUCTIONS_MESSAGE_ID = "lk.agent_task.instructions"

# ── Opschonen voor de stem (zelfde regels als handleTTS in server.js) ─────────────────────
_EMOJI = re.compile("[\U0001f300-\U0001f9ff☀-➿\U0001f000-\U0001f2ff]")
_ARROWS = re.compile("\U0001f447|→|↑|↓")
_BOLD = re.compile(r"\*\*(.+?)\*\*")
_ITALIC = re.compile(r"\*(.+?)\*")
_CODE = re.compile(r"`(.+?)`")

# Meer dan dit aantal tekens zonder sluitende markdown: toch doorsturen.
_MAX_HOLD = 400


def _strip_markup(text: str) -> str:
    text = _EMOJI.sub("", text)
    text = _ARROWS.sub("", text)
    text = _BOLD.sub(r"\1", text)
    text = _ITALIC.sub(r"\1", text)
    return _CODE.sub(r"\1", text)


def clean_tts_text(text: str) -> str:
    """Volledige tekst voor de stem: opmaak eruit en spaties aan de randen weg."""
    return _strip_markup(text).strip()


async def clean_tts_stream(chunks: AsyncIterable[str]) -> AsyncIterator[str]:
    """Stream-variant van `clean_tts_text`.

    De tekst komt in stukjes binnen; markdown (`**vet**`) kan over stukjes heen lopen. Daarom
    wordt er tot de laatste woordgrens doorgestuurd, maar alleen als daar geen openstaande
    `*` of backtick meer in zit. Spaties blijven behouden, zodat de stukjes aan elkaar passen.
    """
    buffer = ""
    async for chunk in chunks:
        buffer += chunk
        cut = max(buffer.rfind(" "), buffer.rfind("\n"))
        if cut <= 0:
            continue
        head = _strip_markup(buffer[: cut + 1])
        if ("*" in head or "`" in head) and len(buffer) < _MAX_HOLD:
            continue
        buffer = buffer[cut + 1 :]
        if head:
            yield head
    tail = _strip_markup(buffer)
    if tail.strip():
        yield tail


# ── Stiltehallucinaties (zelfde lijst als handleTranscribe in server.js) ──────────────────
DEFINITE_JUNK = (
    "thank you for watching",
    "thanks for watching",
    "subtitles by",
    "subs by",
    "subtítulos",
    "music",
    "música",
    "[música]",
    "(music)",
    "[music]",
    "see you next time",
    "...",
    ". . .",
)
_JUNK_PUNCTUATION = re.compile("[¡¿\"'.!?,]")


def is_junk_transcript(text: str) -> bool:
    """Zeker geen echte spraak. Lege tekst (of alleen leestekens) telt ook als afval.

    De bestaande route filtert daarnaast korte "ambiguous fillers" op basis van Whisper's
    `avg_logprob`; die waarde bestaat bij deze herkenners niet, dus dat deel is niet overgenomen.
    """
    lowered = _JUNK_PUNCTUATION.sub("", (text or "").lower()).strip()
    if not lowered:
        return True
    return any(lowered == junk or junk in lowered for junk in DEFINITE_JUNK)


# ── Teller "QUESTIONS ASKED IN A ROW" ─────────────────────────────────────────────────────
def count_consecutive_questions(tutor_messages: Iterable[str]) -> int:
    """Aantal opeenvolgende tutorberichten (vanaf het laatste) dat op '?' eindigt."""
    count = 0
    for content in reversed(list(tutor_messages)):
        if (content or "").strip().endswith("?"):
            count += 1
        else:
            break
    return count


def with_question_counter(chat_ctx: ChatContext) -> ChatContext:
    """Kopie van de context met de teller achter de instructie (zoals `handleTutor`)."""
    tutor_messages = [
        item.text_content or ""
        for item in chat_ctx.items
        if item.type == "message" and item.role == "assistant"
    ]
    suffix = f"\n\nQUESTIONS ASKED IN A ROW: {count_consecutive_questions(tutor_messages)}"

    ctx = chat_ctx.copy()
    idx = ctx.index_by_id(INSTRUCTIONS_MESSAGE_ID)
    if idx is not None and ctx.items[idx].type == "message":
        original = ctx.items[idx]
        ctx.items[idx] = ChatMessage(
            id=INSTRUCTIONS_MESSAGE_ID,
            role="system",
            content=[(original.text_content or "") + suffix],
            created_at=original.created_at,
        )
    else:
        ctx.items.append(ChatMessage(role="system", content=[suffix.strip()]))
    return ctx


class TutorAgent(Agent):
    def __init__(self, meta: TutorMetadata) -> None:
        super().__init__(instructions=build_instructions(meta))
        self.meta = meta

    async def on_user_turn_completed(self, turn_ctx: ChatContext, new_message: ChatMessage) -> None:
        """Afval laten vallen vóór het taalmodel antwoordt; de transcriptie zelf blijft werken."""
        text = new_message.text_content or ""
        if is_junk_transcript(text):
            log.info("junk_transcript_dropped text=%r", text[:60])
            raise StopResponse()

    async def llm_node(
        self,
        chat_ctx: llm.ChatContext,
        tools: list[llm.Tool],
        model_settings: ModelSettings,
    ) -> AsyncIterator[llm.ChatChunk | str]:
        async for chunk in Agent.default.llm_node(
            self, with_question_counter(chat_ctx), tools, model_settings
        ):
            yield chunk

    async def tts_node(
        self, text: AsyncIterable[str], model_settings: ModelSettings
    ) -> AsyncIterator[rtc.AudioFrame]:
        async for frame in Agent.default.tts_node(self, clean_tts_stream(text), model_settings):
            yield frame
