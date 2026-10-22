# SnS Palace in one container: the web app and the editing worker, with
# ffmpeg and on-device speech recognition (faster-whisper).
#
# At home with Tailscale, compose.yaml builds and runs it: docker compose up -d --build
# On its own:
#   docker build -t sns-palace .
#   docker run -d --restart unless-stopped -p 3000:3000 -v sns-palace-data:/data \
#     -e FAMILY_PIN=... -e PARENT_PIN=... sns-palace
#
# Everything SnS Palace keeps (the database, the videos and the downloaded
# speech model) lives in /data, so put a persistent disk there. See
# "Use it from anywhere" in README.md.

ARG NODE_IMAGE=node:22-bookworm-slim
ARG RUNTIME_IMAGE=ubuntu:24.04

FROM ${NODE_IMAGE} AS node

# All dependencies: the build needs the dev ones (Tailwind, TypeScript).
FROM node AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY . .
RUN npm run build \
 && rm -rf .next/cache \
 && npm prune --omit=dev --no-audit --no-fund \
 # The runtime is glibc; drop the Alpine (musl) copies of native packages.
 && rm -rf node_modules/@next/swc-*-musl node_modules/@img/*musl*

# Ubuntu LTS for a recent ffmpeg (with libass for the captions) and Python.
FROM ${RUNTIME_IMAGE} AS runtime
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates ffmpeg python3 python3-venv tini \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --system --create-home --home-dir /home/palace --shell /usr/sbin/nologin palace
COPY worker/requirements.txt /opt/whisper/requirements.txt
RUN python3 -m venv /opt/whisper \
 && /opt/whisper/bin/pip install --no-cache-dir -r /opt/whisper/requirements.txt
COPY --from=node /usr/local/bin/node /usr/local/bin/node

WORKDIR /app
COPY --from=build /app/package.json /app/next.config.ts /app/tsconfig.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
# The worker runs from source and shares src/server with the web app.
COPY --from=build /app/src ./src
COPY --from=build /app/worker ./worker
COPY docker ./docker
# A copy checked out on Windows can have CRLF line endings, which break scripts.
RUN sed -i 's/\r$//' docker/*.sh && chmod +x docker/*.sh

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    DATABASE_DRIVER=local \
    STORAGE_DRIVER=local \
    LOCAL_DATA_DIR=/data \
    TRANSCRIBER=local \
    WHISPER_PYTHON=/opt/whisper/bin/python \
    HF_HOME=/data/models \
    # ffmpeg would start a thread per CPU of the whole host machine; cloud
    # instances get one or two of them, and every thread costs memory.
    FFMPEG_THREADS=2
EXPOSE 3000

# tini forwards stop signals; the entrypoint hands /data to the unprivileged
# "palace" user, then start.sh runs the web app and the worker.
ENTRYPOINT ["tini", "--", "/app/docker/entrypoint.sh"]
CMD ["/app/docker/start.sh"]
