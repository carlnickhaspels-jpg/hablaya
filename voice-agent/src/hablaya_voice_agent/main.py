"""LiveKit Agents 1.x worker voor de HablaYa-tutor.

Per ruimte een `AgentSession` (herkenner, taalmodel, stem) met de agent `TutorAgent`. De worker
meldt zich aan als `hablaya-tutor` en doet alleen mee aan ruimtes waarvoor de server
expliciet een dispatch met die naam meegeeft (nooit automatisch).

De dispatch-metadata (`ctx.job.metadata`) is JSON:
`{"level", "scenario" | null, "greeting", "userName"}`.

Start: `python -m hablaya_voice_agent.main <start|dev|download-files>`.
"""

from __future__ import annotations

import asyncio
import logging

from livekit.agents import AgentServer, JobContext, JobProcess, cli

from hablaya_voice_agent.agent import TutorAgent
from hablaya_voice_agent.config import get_voice_config
from hablaya_voice_agent.metingen import TurnMeter
from hablaya_voice_agent.pipeline import (
    build_session,
    load_plugins,
    select_llm,
    select_stt,
    select_tts,
)
from hablaya_voice_agent.tutor_prompt import parse_metadata

AGENT_NAME = "hablaya-tutor"
GREETING_TIMEOUT_S = 15.0

log = logging.getLogger("hablaya.voice")


def prewarm(proc: JobProcess) -> None:
    """Laad het VAD-model een keer per proces, niet bij elk gesprek.

    Afgestelde silero-VAD (zoals Falcon): de standaardwaarden zien zwakke kamerruis als spraak.
    """
    from livekit.plugins import silero  # noqa: PLC0415

    # Plugins nu importeren, niet bij de eerste beurt (een import blokkeert de event loop).
    load_plugins()
    proc.userdata["vad"] = silero.VAD.load(min_speech_duration=0.2, activation_threshold=0.6)


server = AgentServer(port=get_voice_config().PORT, setup_fnc=prewarm)


@server.rtc_session(agent_name=AGENT_NAME)
async def entrypoint(ctx: JobContext) -> None:
    """Wordt door de LiveKit-runtime per nieuwe ruimte aangeroepen."""
    cfg = get_voice_config()
    meta = parse_metadata(ctx.job.metadata)
    log.info(
        "entrypoint_start room=%s level=%s scenario=%s",
        ctx.room.name,
        meta.level,
        meta.scenario.id if meta.scenario else None,
    )

    session = build_session(
        stt=select_stt(cfg),
        llm=select_llm(cfg),
        tts=select_tts(cfg),
        vad=ctx.proc.userdata["vad"],
        cfg=cfg,
    )
    meter = TurnMeter(room=ctx.room.name)
    session.on("conversation_item_added", meter.on_item)

    # record=False: geen opslag van audio of transcript bij LiveKit (1.x neemt standaard op).
    # Standaard RoomOptions: tekst-transcripties (topic lk.transcription) en het attribuut
    # lk.agent.state staan dan aan voor de webclient.
    await session.start(agent=TutorAgent(meta), room=ctx.room, record=False)

    # Eenmalige begroeting. Begrensd, want de uitspraak wacht op het audiospoor en een
    # mislukte begroeting mag de sessie niet meenemen.
    if meta.greeting:
        try:
            handle = session.say(meta.greeting, allow_interruptions=False)
            await asyncio.wait_for(handle.wait_for_playout(), timeout=GREETING_TIMEOUT_S)
            log.info("greeting_spoken")
        except Exception:
            log.error("greeting_failed", exc_info=True)


def main() -> None:
    """Start de LiveKit Agents worker."""
    cli.run_app(server)


if __name__ == "__main__":
    main()
