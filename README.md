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
| 3 | Real engines: Coqui TTS (VITS, 109 voices) and Wav2Lip lip-sync, one-command setup scripts, live per-batch render progress | Done |

Out of the box the pipeline runs with **placeholder engines**, so the whole
flow works end to end without GPUs or model downloads:

- **Placeholder voice**: a speech-paced hum timed to the script (no real words).
- **Placeholder lip-sync**: the avatar on a blurred 16:9 backdrop with an audio
  waveform, muxed with the audio (no mouth movement).

For real speech and real lip-sync, run the two setup scripts (see
[Real engines](#real-engines-coqui-tts--wav2lip)):

```bash
backend/scripts/setup_coqui.sh     # Coqui TTS voices
backend/scripts/setup_wav2lip.sh   # Wav2Lip lip-sync
./dev.sh                           # restart: the header now shows coqui + wav2lip
```

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
     1. Script    normalise text; fix photo orientation, fit to 1280×720 (0–10 %)
     2. Audio     services/audio.py  placeholder | coqui | elevenlabs  → audio.wav   (10–40 %)
     3. Lip-sync  services/video.py  placeholder | wav2lip | sadtalker → render      (40–92 %)
     4. Video     ffmpeg → framed on a 16:9 canvas, H.264/AAC MP4 with faststart (92–100 %)
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
│   ├── scripts/            # setup_coqui.sh, setup_wav2lip.sh
│   ├── engines/            # Wav2Lip compatibility patch (+ the checkout, gitignored)
│   ├── tests/              # pytest suite (API, pipeline, engine adapters)
│   ├── requirements*.txt   # core, coqui and wav2lip dependencies
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

External engines run as subprocesses. `OAS_WAV2LIP_PYTHON` and
`OAS_SADTALKER_PYTHON` can point at a separate environment, so an engine's
dependencies need not live in the API's virtualenv. Every engine's output is
framed onto the 1280×720 canvas and re-encoded to a browser-friendly MP4.

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

# backend, against the real Coqui + Wav2Lip install (slow, opt-in)
OAS_TEST_FACE=/path/to/portrait.jpg .venv/bin/python -m pytest tests/test_real_engines.py

# frontend
cd frontend && npm run lint && npx tsc --noEmit && npm run build
```

## Known limitations

- Jobs live in memory, so restarting the backend forgets in-flight and past jobs
  (their files stay in `backend/storage/jobs/`). Use Redis and a task queue before
  running more than one backend process.
- The placeholder engines produce no real speech and no mouth movement; run the
  setup scripts for real ones.
- Wav2Lip animates the mouth only: the head, eyes and expression stay still.
- Output is H.264 MP4, which current Chrome, Edge, Firefox and Safari all play.
  Some open-source Chromium builds ship without H.264.
