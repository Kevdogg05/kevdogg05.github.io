# OpenAvatarStudio

A self-hosted, open-source alternative to HeyGen: type a script, pick a voice,
upload a portrait, and get back a talking-avatar video. Everything runs on your
own machine. No HeyGen services or accounts are involved.

> This repository also hosts the static GitHub Pages site (`brain-gate-quest/`,
> `sewcraft-3d/`, and `level-up-shelf/`, a 3D-printable toy shelf). OpenAvatarStudio lives in `frontend/` and `backend/` and runs
> locally; GitHub Pages does not serve it. Its project page, with screenshots,
> setup steps and a QR code, is `open-avatar-studio/`:
> https://kevdogg05.github.io/open-avatar-studio/
>
> **SnS Palace**, a private family video studio (kids upload, an automatic editor
> trims and captions, parents approve), lives in `sns-palace/`. It runs on a
> computer at home, reachable from anywhere for free through Tailscale
> (`sns-palace/compose.yaml`), or on paid hosting such as Render (`render.yaml`
> at the top of this repository). See [sns-palace/README.md](sns-palace/README.md). Its project page,
> with screenshots, setup steps and a QR code, is `sns-palace/index.html`:
> https://kevdogg05.github.io/sns-palace/

## Status

| Phase | Scope | State |
| --- | --- | --- |
| 1 | Monorepo, Next.js dashboard (script editor, voice picker, drag-and-drop avatar upload, preview player, generate button + live progress) | Done |
| 2 | FastAPI backend: avatar upload, `/api/generate` pipeline (Script → Audio → Lip-Sync → Video), job progress, pluggable voice and lip-sync engines | Done |
| 3 | Real engines: Coqui TTS (VITS, 109 voices) and Wav2Lip lip-sync, one-command setup scripts, live per-batch render progress | Done |
| 4 | Realistic avatars: SadTalker (blinks, expressions, head motion) and GFPGAN face enhancement, chosen per video in the dashboard with render-time estimates | Done |
| 5 | Video library: SQLite-backed jobs that survive restarts, a gallery with replay/download/retry/delete, a queue you can add to while rendering, cancel (kills the engine), automatic cleanup | Done |
| 6 | Self-host packaging: Docker Compose (CPU, or NVIDIA GPU with an override) with the engines baked in, one port behind Caddy, optional password, automatic HTTPS | Done |

Out of the box the pipeline runs with **placeholder engines**, so the whole
flow works end to end without GPUs or model downloads:

- **Placeholder voice**: a speech-paced hum timed to the script (no real words).
- **Placeholder lip-sync**: the avatar on a blurred 16:9 backdrop with an audio
  waveform, muxed with the audio (no mouth movement).

For real speech and animation, run the setup scripts (see
[Real engines](#real-engines-coqui-tts--wav2lip) and
[Realistic avatars](#realistic-avatars-sadtalker--face-enhancement)):

```bash
backend/scripts/setup_coqui.sh       # Coqui TTS voices
backend/scripts/setup_wav2lip.sh     # Wav2Lip lip-sync (fast)
backend/scripts/setup_sadtalker.sh   # SadTalker whole-face animation (needs a GPU to be quick)
backend/scripts/setup_gfpgan.sh      # GFPGAN face enhancement (optional)
./dev.sh                             # restart, then pick the engine per video
```

## Architecture

```
 Browser ── Next.js dashboard (frontend/, :3000)
   │
   │  POST /api/avatars/upload   portrait PNG/JPG       → avatar_id
   │  POST /api/generate         script, voice, avatar, engine, options → job (202)
   │  GET  /api/jobs             the library, polled every 1 s while anything renders
   │  POST /api/jobs/{id}/cancel | /retry,  DELETE /api/jobs/{id}
   │  GET  /media/jobs/{id}/video.mp4
   ▼
 FastAPI (backend/, :8000)
   main.py ─ routes, CORS, static /media
   services/jobs.py ─ SQLite job store (storage/oas.db)
   services/pipeline.py ─ worker pool and queue, runs each job through:
     1. Script    normalise text; fix photo orientation, fit to 1280×720
     2. Audio     services/audio.py    placeholder | coqui | elevenlabs → audio.wav
     3. Animate   services/video.py    wav2lip | sadtalker | placeholder (chosen per job)
     3b. Enhance  services/enhance.py  GFPGAN v1.4 on every frame (optional per job)
     4. Video     ffmpeg → framed on a 16:9 canvas, H.264/AAC MP4 with faststart
```

```
.
├── dev.sh                  # starts backend + frontend together (development)
├── docker-compose.yml      # the whole studio in Docker (+ docker-compose.gpu.yml)
├── .env.example            # Docker settings: password, domain, engines, ports
├── deploy/proxy/           # Caddy front door: routing, password, HTTPS
├── backend/
│   ├── main.py             # FastAPI app factory and routes
│   ├── config.py           # settings from env / backend/.env
│   ├── schemas.py          # request/response models
│   ├── services/
│   │   ├── audio.py        # TTS providers
│   │   ├── video.py        # lip-sync engines
│   │   ├── pipeline.py     # orchestration, queue, cancel/retry/delete, cleanup
│   │   ├── jobs.py         # SQLite-backed job store
│   │   ├── storage.py      # avatar upload validation/storage
│   │   ├── media.py        # ffmpeg helpers
│   │   └── common.py       # shared types and errors
│   ├── scripts/            # setup_coqui.sh, setup_wav2lip.sh, setup_sadtalker.sh, setup_gfpgan.sh
│   ├── engines/            # compatibility patches, gfpgan_enhance.py (+ checkouts and weights, gitignored)
│   ├── tests/              # pytest suite (API, pipeline, engine adapters)
│   ├── requirements*.txt   # core and per-engine dependencies
│   ├── Dockerfile          # API + engines image
│   └── .env.example
└── frontend/
    ├── Dockerfile          # standalone Next.js image
    └── src/
        ├── app/            # Next.js App Router entry (layout, page, styles)
        ├── components/studio/  # dashboard UI components
        ├── hooks/          # backend status, avatar upload, job polling
        └── lib/            # API client and formatting helpers
```

## Quick start

To run it on a server, or without installing Python and Node.js yourself, see
[Deploy with Docker](#deploy-with-docker). For development:

Requirements: **Node.js 20+** and **Python 3.10+**. ffmpeg is optional: the
backend uses the one on your `PATH`, or the binary bundled with `imageio-ffmpeg`.

```bash
./dev.sh
```

The first run creates `backend/.venv` and runs `npm install`. Then open:

- Dashboard: http://localhost:3000
- API docs (Swagger): http://localhost:8000/docs

`BACKEND_PORT`, `FRONTEND_PORT` and `BACKEND_HOST` (default `127.0.0.1`)
override the defaults.

### Manual start (or on Windows)

```bash
# Terminal 1: backend
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Terminal 2: frontend
cd frontend
npm install
npm run dev
```

## Deploy with Docker

The easiest way to run the studio on a home server, a GPU workstation or a VPS.
Docker Compose builds three containers, bakes the engines and their models into
the backend image, and serves everything on one port with an optional password.

```bash
cp .env.example .env          # optional: set OAS_PASSWORD, choose engines, ports
docker compose up -d --build  # the first build downloads several GB and takes a while
```

Then open http://localhost:8080 (or `http://<server-ip>:8080`).

The backend image with all four engines is about 5 GB with the CPU build of
PyTorch, and about 9.5 GB with CUDA (whose libraries account for over 5 GB).
List fewer engines in `OAS_ENGINES` for a smaller image.

With an NVIDIA GPU (install the NVIDIA driver and the
[NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html)
first), add the GPU override. It builds PyTorch with CUDA and passes the GPU
through, which is what makes SadTalker and face enhancement fast:

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d --build
```

| Container | What it runs |
| --- | --- |
| `proxy` | Caddy: the only published port. Routes `/api`, `/media` and `/docs` to the backend and everything else to the dashboard, asks for the password, and handles HTTPS. |
| `frontend` | The Next.js dashboard as a standalone server. It calls the API on its own origin, so no CORS or extra ports are involved. |
| `backend` | The API and engines (Python 3.13, ffmpeg, espeak-ng, PyTorch, model weights), running as an unprivileged user. |

Videos, uploads and the job database live in the `studio-data` volume, so
`docker compose down` and image rebuilds keep your library. `docker compose
down -v` deletes it. To update: `git pull && docker compose up -d --build`. The
engine layers are reused unless the engine list or the setup scripts change.

Settings go in `.env` next to `docker-compose.yml`:

| Variable | Default | Purpose |
| --- | --- | --- |
| `OAS_PASSWORD` | empty | Ask for a login on every page and API call. **Set this before exposing the port beyond your own machine.** |
| `OAS_USERNAME` | `admin` | Login name |
| `OAS_DOMAIN` | empty | Public hostname, e.g. `studio.example.com`, for automatic HTTPS from Let's Encrypt. Point its DNS at the server and set the ports to 80 and 443. |
| `OAS_HTTP_PORT` / `OAS_HTTPS_PORT` | `8080` / `8443` | Ports published on the host |
| `OAS_ENGINES` | `coqui wav2lip sadtalker gfpgan` | Engines baked into the backend image. Leave it empty for a small image with only the placeholder engines. |
| `OAS_TORCH` | `cpu` | PyTorch build: `cpu` or `cuda` (the GPU override sets `cuda`) |
| `OAS_MAX_CONCURRENT_JOBS`, `OAS_RETENTION_DAYS`, `ELEVENLABS_API_KEY` | | Passed to the backend; see [Configuration](#configuration) |

Any other backend setting from `backend/.env.example` can be added under
`backend.environment` in `docker-compose.yml`.

Without `OAS_DOMAIN`, the studio is served over plain HTTP. That's fine on your
own machine or home network, but use a domain (or a VPN such as Tailscale) when
reaching it over the internet, so the password isn't sent unencrypted.

## Configuration

Backend settings come from environment variables or `backend/.env` (copy
`backend/.env.example`). The most important ones:

| Variable | Default | Purpose |
| --- | --- | --- |
| `OAS_TTS_PROVIDER` | `placeholder` | `placeholder`, `coqui` or `elevenlabs` |
| `OAS_LIPSYNC_ENGINE` | `placeholder` | Default engine: `wav2lip`, `sadtalker` or `placeholder` (each video can pick another) |
| `OAS_STORAGE_DIR` | `backend/storage` | Uploaded avatars and rendered jobs |
| `OAS_CORS_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Extra allowed origins (any `localhost` port is always allowed) |
| `OAS_MAX_UPLOAD_MB` | `10` | Avatar size limit |
| `OAS_MAX_SCRIPT_CHARS` | `5000` | Script length limit |
| `OAS_MAX_CONCURRENT_JOBS` | `1` | Parallel renders (lip-sync models usually fill a GPU); the rest queue |
| `OAS_RETENTION_DAYS` | `0` | Delete finished videos, and avatar uploads no video uses, after this many days (`0` keeps everything) |
| `OAS_FFMPEG_PATH` | auto | Explicit ffmpeg binary |

The frontend talks to port 8000 on whatever host served the page. Set
`NEXT_PUBLIC_API_URL` in `frontend/.env.local` to point it elsewhere.

## Real engines: Coqui TTS + Wav2Lip

Each engine reports whether it is ready at `GET /api/health`, and the dashboard
header shows the active engines. Both setup scripts are safe to re-run; each
one finishes by enabling its engine in `backend/.env`. They run on Linux, macOS
and WSL.

### Voice: Coqui TTS

```bash
sudo apt install espeak-ng        # macOS: brew install espeak-ng (VITS phonemizer)
backend/scripts/setup_coqui.sh
```

This installs PyTorch and `coqui-tts` into `backend/.venv` and downloads
`tts_models/en/vctk/vits` (about 150 MB, Apache-2.0) to Coqui's cache
(`~/.local/share/tts`). The model runs in-process and is loaded in the
background at startup, so jobs don't wait for it. On a 4-core CPU it speaks
about 4 seconds of audio per second of compute.

The voice menu offers six VCTK speakers spread across the pitch range, each
labelled with its measured median pitch. Choose your own with
`OAS_COQUI_SPEAKERS=p225,p243=Narrator` (all 108 VCTK speakers `p225`–`p376`
are valid). Other Coqui models work too: set `OAS_COQUI_MODEL`, and for
multilingual models such as XTTS v2 also `OAS_COQUI_LANGUAGE`. XTTS has a
non-commercial licence (CPML) and is much slower on CPU.

### Lip-sync: Wav2Lip

```bash
backend/scripts/setup_wav2lip.sh
```

This clones [Wav2Lip](https://github.com/Rudrabha/Wav2Lip) at a pinned commit
into `backend/engines/Wav2Lip`, applies `engines/wav2lip-compat.patch`, installs
its dependencies and downloads the `wav2lip_gan` and `s3fd` face-detector
weights (about 520 MB) with SHA-256 checks. The upstream download links point at
a SharePoint folder, so the script uses GitHub mirrors that serve byte-identical
files. Override them with `WAV2LIP_GAN_URL` and `WAV2LIP_S3FD_URL`.

Wav2Lip was written for Python 3.6 and PyTorch 1.1. The patch is limited to the
inference path: keyword arguments for the librosa mel filter, `np.int` → `np.int32`,
CPU-safe face-detector loading, extension detection that isn't confused by dots
in a path, and ffmpeg calls that don't go through a shell. It was tested with
Python 3.13, PyTorch 2.14, NumPy 2.5 and librosa 1.0.

On a 4-core CPU a job costs 7–17 s of fixed overhead (Python start-up, face
detection and loading the 436 MB model), then roughly 1 s of compute per 1.5 s
of video. A 10-second clip takes about 20 s end to end. Progress in the UI follows
Wav2Lip's own batches. A GPU is used automatically when PyTorch can see one.
`OAS_WAV2LIP_BATCH_SIZE` (default 32) trades memory for speed.

> **Licences.** The Wav2Lip code and weights are for personal, research and
> non-commercial use only; commercial use needs a licence from its authors
> (see their README). The VCTK VITS voice model is Apache-2.0. espeak-ng is
> GPL-3.0 and runs as a separate program.

Tips for good results: use a well-lit, front-facing photo where the face is
clearly visible and not too small. Wav2Lip regenerates only the mouth region at
96×96 pixels, so the lower face can look softer than the rest of the image. If
no face is found, the job fails and says so.

### Voice: ElevenLabs (developer API)

```bash
# backend/.env
OAS_TTS_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=your-key
```

The voice dropdown is filled from your ElevenLabs account.

External engines run as subprocesses. `OAS_WAV2LIP_PYTHON`, `OAS_SADTALKER_PYTHON`
and `OAS_ENHANCER_PYTHON` can point at a separate environment, so an engine's
dependencies need not live in the API's virtualenv. Every engine's output is
framed onto the 1280×720 canvas and re-encoded to a browser-friendly MP4.

## Realistic avatars: SadTalker + face enhancement

Wav2Lip moves only the mouth. For a more lifelike presenter, the dashboard's
**Animation** panel lets each video use:

- **SadTalker**: animates the whole face from the audio, with blinking,
  expressions and, with **Head motion** on, natural head movement. It works on
  the full photo, so the body and background stay in place.
- **Enhance face**: runs GFPGAN v1.4 on every frame after animation. It
  sharpens the eyes, teeth and lips, which both engines otherwise render softly
  (Wav2Lip at 96 px, SadTalker at 256 px). It works with any engine.

```bash
backend/scripts/setup_sadtalker.sh   # ~1.2 GB of checkpoints + face-alignment weights
backend/scripts/setup_gfpgan.sh      # ~550 MB: GFPGAN v1.4 + face detection/parsing
```

Each script clones or installs at a pinned version and checks every download
against a SHA-256. The scripts don't change the default engine; you choose per
video. Unready options stay greyed out in the dashboard, which explains what to
install.

**Speed.** Both are heavy neural networks. On a 4-core CPU (measured here) they
cost roughly:

| Option | CPU time per second of video | 10-second clip |
| --- | --- | --- |
| Wav2Lip | ~0.7 s (+ ~12 s start-up) | ~20 s |
| SadTalker | ~95 s (+ ~15 s start-up) | ~16 min |
| + Enhance face | ~45 s more | ~8 min more |

With an NVIDIA GPU, PyTorch uses it automatically and these drop to seconds.
The dashboard shows an estimate for the current script before you generate.
`OAS_SADTALKER_BATCH_SIZE` (default 2) can go higher on a GPU; on CPU a batch of
8 was slower per frame.

**How they run on current Python.** SadTalker gets a six-line patch
(`engines/sadtalker-compat.patch`): NumPy 2 fixes, a lazy import of its
built-in enhancer (which we replace), and a proper error instead of a crash
when the photo has no face. The `gfpgan` package depends on `basicsr`,
which no longer builds on Python 3.13. So `engines/gfpgan_enhance.py` loads
GFPGAN's dependency-free "clean" architecture directly and uses `facexlib` for
face detection and blending. It re-parses the face mask every 2 seconds of video
instead of every frame, which halves the CPU cost for the same result.

> **Licences.** SadTalker is Apache-2.0; its README notes that the earlier
> non-commercial restriction was removed. GFPGAN is Apache-2.0, but its licence
> lists StyleGAN2-derived code under NVIDIA's licence, which restricts
> commercial use. Check both, and Wav2Lip's terms, before using this
> commercially.

## Video library

Every video is recorded in `backend/storage/oas.db` (SQLite), next to its files
in `backend/storage/jobs/<id>/`, so the **Your videos** gallery survives backend
restarts. From the gallery you can:

- **Queue** several videos: Generate works while another video renders, and
  each queued card shows its place in line. `OAS_MAX_CONCURRENT_JOBS` sets how
  many render at once.
- **Cancel** a queued or rendering video. A render stops within a few seconds;
  the Wav2Lip, SadTalker or GFPGAN process is killed rather than left to finish.
- **Replay** (click a card), **download**, **render again** with the same
  script, voice, photo and options, or **delete** a video and its files.

When the backend restarts, queued videos pick up where they were. A video that
was rendering is marked "interrupted" (use Render again). With `uvicorn --reload`
that includes saving a backend source file. Finished videos keep only
`video.mp4`, `audio.wav` and a poster frame; intermediate engine files are
deleted. Set `OAS_RETENTION_DAYS` to delete old videos automatically.

## API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Device (`cpu`/`cuda`), voice provider, every animation engine (ready, summary, CPU estimate), face enhancer, ffmpeg |
| `GET` | `/api/voices` | Voices offered by the active provider |
| `POST` | `/api/avatars/upload` | Multipart `file` (PNG/JPEG, checked by content). Returns `avatar_id` and `url` |
| `POST` | `/api/generate` | `{script, voice_id, avatar_id, engine?, enhance?, head_motion?}` → `202` with a job; `409` if the engine or enhancer isn't installed |
| `GET` | `/api/jobs?limit&offset` | The library, newest first, with `total`, `active` (queued + running) and `storage_bytes` |
| `GET` | `/api/jobs/{job_id}` | `status` (queued/running/completed/failed/cancelled), `stage`, `progress`, `message`, `error`, `queue_position`, `video_url`, `poster_url`, `render_seconds`, … |
| `POST` | `/api/jobs/{job_id}/cancel` | Cancel a queued or running job (`409` once finished) |
| `POST` | `/api/jobs/{job_id}/retry` | Queue a new job with the same settings → `202` |
| `DELETE` | `/api/jobs/{job_id}` | Delete a finished job and its files → `204` (`409` while active) |
| `GET` | `/media/...` | Uploaded avatars and rendered audio/video (supports HTTP range requests) |

## Development

```bash
# backend
cd backend && .venv/bin/pip install -r requirements-dev.txt && .venv/bin/python -m pytest

# backend, against the real Coqui + Wav2Lip install (slow, opt-in); add engines
# and enhancement with e.g. OAS_TEST_ENGINES=wav2lip,sadtalker OAS_TEST_ENHANCE=1
OAS_TEST_FACE=/path/to/portrait.jpg .venv/bin/python -m pytest tests/test_real_engines.py

# frontend
cd frontend && npm run lint && npx tsc --noEmit && npm run build
```

## Known limitations

- One backend process owns the queue (SQLite plus in-process workers). Running
  several API processes against the same storage would need a shared task queue
  (e.g. Redis with RQ or Celery).
- A video that is mid-render when the backend restarts is not resumed; it is
  marked interrupted, and Render again starts it over.
- The placeholder engines produce no real speech and no mouth movement; run the
  setup scripts for real ones.
- Wav2Lip animates the mouth only: the head, eyes and expression stay still.
  SadTalker animates the whole face but is slow without a GPU, and its lip
  shapes are less precise than Wav2Lip's.
- Output is H.264 MP4, which current Chrome, Edge, Firefox and Safari all play.
  Some open-source Chromium builds ship without H.264.
