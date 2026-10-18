# Dockerfile voor hablaya-voice-agent (proof of concept).
#
# Build context = voice-agent/ (Railway: root directory voice-agent/).
# De LiveKit Agents worker verbindt uitgaand met LiveKit Cloud: er is geen inkomende
# HTTP-server nodig, dus bewust geen healthcheck.

# ─── Builder ─────────────────────────────────────────────────────────────
FROM python:3.12-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:0.11.16 /uv /usr/local/bin/uv

WORKDIR /app
COPY . /app

ENV UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1
RUN uv sync --frozen --no-dev

# Pre-download van plugin-bestanden, zodat de worker direct start zonder koude download.
# (Het silero-model zit in het pakket zelf; de stap is een vangnet voor plugins die wel
# iets ophalen. Dezelfde stap draait in de Falcon-agent.)
ENV PATH="/app/.venv/bin:$PATH"
RUN python -m hablaya_voice_agent.main download-files

# ─── Runtime ─────────────────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

RUN groupadd --gid 10001 hablaya \
 && useradd  --uid 10001 --gid hablaya --shell /bin/bash --create-home hablaya

WORKDIR /app
COPY --from=builder --chown=hablaya:hablaya /app /app

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8081

EXPOSE 8081

USER hablaya

# `start` = productiemodus van de LiveKit Agents CLI. Zonder dit toont de CLI alleen de help
# en sluit af, wat op Railway een herstartlus geeft.
CMD ["python", "-m", "hablaya_voice_agent.main", "start"]
