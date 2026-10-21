# OpenAvatarStudio

A self-hosted, open-source alternative to HeyGen: type a script, pick a voice,
upload a portrait, and get back a talking-avatar video. Everything runs on your
own machine. No HeyGen services or accounts are involved.

> This repository also hosts the static GitHub Pages site (`brain-gate-quest/`,
> `sewcraft-3d/`). OpenAvatarStudio lives in `frontend/` and `backend/` and runs
> locally; GitHub Pages does not serve it.

## Status

| Phase | Scope | State |
| --- | --- | --- |
| 1 | Monorepo, Next.js dashboard (script editor, voice picker, drag-and-drop avatar upload, preview player, generate button + live progress) | Done |
| 2 | FastAPI backend: avatar upload, `/api/generate` pipeline (Script → Audio → Lip-Sync → Video), job progress, pluggable voice and lip-sync engines | Done |

Out of the box the pipeline runs with **placeholder engines**, so the whole
flow works end to end without GPUs or model downloads:

- **Placeholder voice**: a speech-paced hum timed to the script (no real words).
- **Placeholder lip-sync**: the avatar on a blurred 16:9 backdrop with an audio
  waveform, muxed with the audio (no mouth movement).

To get real speech and real lip-sync, switch to Coqui TTS / ElevenLabs and
Wav2Lip / SadTalker with environment variables (see
[Real engines](#plugging-in-real-engines)).

## Architecture

```
 Browser ── Next.js dashboard (frontend/, :3000)
   │
   │  POST /api/avatars/upload   portrait PNG/JPG       → avatar_id
   │  POST /api/generate         script, voice, avatar  → job (202)
   │  GET  /api/jobs/{id}        polled every 600 ms    → stage + progress %
   │  GET  /media/jobs/{id}/video.mp4
   ▼
 FastAPI (backend/, :8000)
   main.py ─ routes, CORS, static /media
   services/pipeline.py ─ job store + worker pool, runs each job through:
     1. Script    normalise and validate                       (0–10 %)
     2. Audio     services/audio.py  placeholder | coqui | elevenlabs  → audio.wav   (10–40 %)
     3. Lip-sync  services/video.py  placeholder | wav2lip | sadtalker → render      (40–92 %)
     4. Video     ffmpeg → H.264/AAC MP4 with faststart                         (92–100 %)
```

```
.
├── dev.sh                  # starts backend + frontend together
├── backend/
│   ├── main.py             # FastAPI app factory and routes
│   ├── config.py           # settings from env / backend/.env
│   ├── schemas.py          # request/response models
│   ├── services/
│   │   ├── audio.py        # TTS providers
│   │   ├── video.py        # lip-sync engines
│   │   ├── pipeline.py     # orchestration + job store
│   │   ├── storage.py      # avatar upload validation/storage
│   │   ├── media.py        # ffmpeg helpers
│   │   └── common.py       # shared types and errors
│   ├── tests/              # pytest suite (API, pipeline, engine adapters)
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    └── src/
        ├── app/            # Next.js App Router entry (layout, page, styles)
        ├── components/studio/  # dashboard UI components
        ├── hooks/          # backend status, avatar upload, job polling
        └── lib/            # API client and formatting helpers
```

## Quick start

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

## Configuration

Backend settings come from environment variables or `backend/.env` (copy
`backend/.env.example`). The most important ones:

| Variable | Default | Purpose |
| --- | --- | --- |
| `OAS_TTS_PROVIDER` | `placeholder` | `placeholder`, `coqui` or `elevenlabs` |
| `OAS_LIPSYNC_ENGINE` | `placeholder` | `placeholder`, `wav2lip` or `sadtalker` |
| `OAS_STORAGE_DIR` | `backend/storage` | Uploaded avatars and rendered jobs |
| `OAS_CORS_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Extra allowed origins (any `localhost` port is always allowed) |
| `OAS_MAX_UPLOAD_MB` | `10` | Avatar size limit |
| `OAS_MAX_SCRIPT_CHARS` | `5000` | Script length limit |
| `OAS_MAX_CONCURRENT_JOBS` | `1` | Parallel renders (lip-sync models usually fill a GPU) |
| `OAS_FFMPEG_PATH` | auto | Explicit ffmpeg binary |

The frontend talks to port 8000 on whatever host served the page. Set
`NEXT_PUBLIC_API_URL` in `frontend/.env.local` to point it elsewhere.

## Plugging in real engines

Each engine reports whether it is ready at `GET /api/health`, and the dashboard
header shows the active engines.

### Voice: Coqui TTS (open source, local)

```bash
cd backend && source .venv/bin/activate
pip install coqui-tts
# backend/.env
OAS_TTS_PROVIDER=coqui
OAS_COQUI_MODEL=tts_models/en/vctk/vits     # downloaded on first use
OAS_COQUI_SPEAKERS=p225,p226,p227,p228       # shown in the voice dropdown
OAS_COQUI_DEVICE=cuda                        # or cpu
```

### Voice: ElevenLabs (developer API)

```bash
# backend/.env
OAS_TTS_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=your-key
```

The voice dropdown is filled from your ElevenLabs account.

### Lip-sync: Wav2Lip

```bash
git clone https://github.com/Rudrabha/Wav2Lip
# set up its environment per its README and download wav2lip_gan.pth into Wav2Lip/checkpoints/
# backend/.env
OAS_LIPSYNC_ENGINE=wav2lip
OAS_WAV2LIP_DIR=/path/to/Wav2Lip
OAS_WAV2LIP_PYTHON=/path/to/wav2lip-env/bin/python
```

Wav2Lip shells out to `ffmpeg` itself, so it must be on `PATH` for that environment.

### Lip-sync: SadTalker

```bash
git clone https://github.com/OpenTalker/SadTalker
# set up its environment and run scripts/download_models.sh
# backend/.env
OAS_LIPSYNC_ENGINE=sadtalker
OAS_SADTALKER_DIR=/path/to/SadTalker
OAS_SADTALKER_PYTHON=/path/to/sadtalker-env/bin/python
OAS_SADTALKER_EXTRA_ARGS=--still --preprocess full --enhancer gfpgan
```

External engines run as subprocesses with their own Python interpreter, so their
heavy GPU dependencies never have to be installed into the API's virtualenv.
Their output is re-encoded to a browser-friendly MP4.

## API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Status of the voice provider, lip-sync engine and ffmpeg |
| `GET` | `/api/voices` | Voices offered by the active provider |
| `POST` | `/api/avatars/upload` | Multipart `file` (PNG/JPEG, checked by content). Returns `avatar_id` and `url` |
| `POST` | `/api/generate` | `{script, voice_id, avatar_id}` → `202` with a job; runs the pipeline in the background |
| `GET` | `/api/jobs/{job_id}` | `status`, `stage`, `progress` (0–100), `message`, `error`, `video_url`, `audio_url` |
| `GET` | `/media/...` | Uploaded avatars and rendered audio/video (supports HTTP range requests) |

## Development

```bash
# backend
cd backend && .venv/bin/pip install -r requirements-dev.txt && .venv/bin/python -m pytest

# frontend
cd frontend && npm run lint && npx tsc --noEmit && npm run build
```

## Known limitations

- Jobs live in memory, so restarting the backend forgets in-flight and past jobs
  (their files stay in `backend/storage/jobs/`). Use Redis and a task queue before
  running more than one backend process.
- The placeholder engines produce no real speech and no mouth movement.
- Output is H.264 MP4, which current Chrome, Edge, Firefox and Safari all play.
  Some open-source Chromium builds ship without H.264.
