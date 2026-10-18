"""Meting per gesproken beurt: een logregel `voice_turn_done`.

LiveKit 1.x zet de vertragingen per beurt op `ChatMessage.metrics`. We luisteren naar
`conversation_item_added`:

- het bericht van de leerling draagt `transcription_delay` (STT) en `end_of_turn_delay`
  (beurtwisseling),
- het antwoord van de tutor draagt `llm_node_ttft` (eerste token), `tts_node_ttfb` (eerste
  audio van de stem) en `e2e_latency` (einde van de spraak tot het begin van het antwoord).

Geen audio of tekst in de logregel. De regel is `voice_turn_done` gevolgd door JSON.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from livekit.agents.llm import ChatMessage

log = logging.getLogger("hablaya.voice.metrics")


def _round(x: float | None) -> float | None:
    return None if x is None else round(float(x), 3)


class TurnMeter:
    def __init__(self, *, room: str = "") -> None:
        self._room = room
        self._stt: float | None = None
        self._eou: float | None = None
        self.turns = 0

    def format_line(self, assistant: ChatMessage) -> str:
        m = assistant.metrics or {}
        fields = {
            "room": self._room,
            "stt_delay_s": _round(self._stt),
            "eou_delay_s": _round(self._eou),
            "llm_ttft_s": _round(m.get("llm_node_ttft")),
            "tts_ttfb_s": _round(m.get("tts_node_ttfb")),
            "e2e_latency_s": _round(m.get("e2e_latency")),
            "interrupted": bool(assistant.interrupted),
        }
        return "voice_turn_done " + json.dumps(fields)

    def on_item(self, event: Any) -> None:
        """Handler voor `conversation_item_added`."""
        item = getattr(event, "item", None)
        if not isinstance(item, ChatMessage):
            return
        if item.role == "user":
            m = item.metrics or {}
            self._stt = m.get("transcription_delay")
            self._eou = m.get("end_of_turn_delay")
            return
        if item.role != "assistant":
            return
        self.turns += 1
        log.info(self.format_line(item))
        self._stt = self._eou = None
