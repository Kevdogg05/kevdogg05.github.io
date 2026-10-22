# OpenAvatarStudio API + render engines.
#
#   OAS_ENGINES  which real engines to install (default: all four). Each one is
#                set up by its scripts/setup_*.sh, exactly as on a workstation;
#                leave it empty for a small image with the placeholder engines.
#   OAS_TORCH    cpu (default, smaller) or cuda (for an NVIDIA GPU).
#
# Model weights are baked into the image, so containers start without network
# access. Videos, uploads and the job database live in the /data volume.
FROM python:3.13-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    TTS_HOME=/app/models/tts

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg espeak-ng git curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Engines first: these layers are large and only change with the engine list.
COPY requirements*.txt ./
COPY scripts ./scripts
COPY engines/*.patch engines/gfpgan_enhance.py ./engines/
RUN python -m venv .venv && .venv/bin/pip install -r requirements.txt

ARG OAS_ENGINES="coqui wav2lip sadtalker gfpgan"
ARG OAS_TORCH=cpu
# The setup scripts also record the installed engines as defaults in /app/.env.
RUN set -e; for engine in $OAS_ENGINES; do OAS_TORCH="$OAS_TORCH" "scripts/setup_$engine.sh"; done

COPY . .

# Run as an unprivileged user. It needs write access to /data and to the
# SadTalker checkout, where SadTalker writes its scratch files.
RUN useradd --create-home --uid 1000 oas \
 && mkdir -p /data \
 && chown oas /data \
 && if [ -d engines/SadTalker ]; then chown oas engines/SadTalker; fi
USER oas
ENV OAS_STORAGE_DIR=/data \
    NUMBA_CACHE_DIR=/tmp/numba \
    MPLCONFIGDIR=/tmp/matplotlib
VOLUME ["/data"]
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=4)"

CMD [".venv/bin/uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
