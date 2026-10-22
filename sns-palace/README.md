# SnS Palace

A private, self-hosted video studio for kids. They upload videos from a
bright drag-and-drop dashboard, and an automatic editor trims the awkward
pauses, burns in big colourful captions and compresses the clip for the web. A
grown-up watches the raw upload next to the edit and approves it before it
reaches the family feed. Nothing involves YouTube, and nothing is public.

Built with Next.js 16 (App Router, TypeScript, Tailwind CSS 4), Supabase
(PostgreSQL) for metadata and Cloudinary for video storage and streaming. A
fully offline mode swaps those for SQLite and local files.

**Project page:** https://kevdogg05.github.io/sns-palace/, with screenshots,
setup steps and a QR code. It's `index.html` and `site/` in this folder, served by
GitHub Pages; the app itself runs on your own computer. The QR code comes as
`site/qr-code.svg` (plain, for printing at any size) and `site/qr-code.png`
(a branded "Scan to open on your phone" card).

## How it works

```
 Kid's browser                                 Parent's browser
   │  drag & drop (react-dropzone)                │  /parent: raw vs. edit, approve/delete
   ▼                                              ▼
 Next.js app ─ src/proxy.ts: household PIN gate on every page and API route
   POST /api/upload        streams the file straight into storage (never buffered),
                           inserts a row: status=pending, pipeline_status=queued
   GET  /api/videos        feed (approved only) / everything (parent)
   PATCH/DELETE /api/videos/:id   approve, unapprove, re-run edit, rename, delete
   GET  /api/media/:id/:variant   streams media to signed-in devices, with byte ranges
   │                                   ▲
   ▼                                   │ private assets, signed URLs server-side only
 Supabase Postgres  ◀── claim_next_video() ──  Editing worker (npm run worker)
   videos table              │                  1 probe       ffprobe: size, rotation, audio
                             │                  2 preview     thumbnail + browser-safe copy (published at once)
 Cloudinary (authenticated)  │                  3 transcribe  word timings (faster-whisper / OpenAI)
   raw / preview / edited /  │                  4 silence     ffmpeg silencedetect → cut plan
   webm / thumbnail ◀────────┘                  5 render      one ffmpeg pass: trim + join + scale +
                                                              captions + loudness → MP4 (+ WebM)
                                                6 publish     upload, mark ready for review
```

The upload route returns as soon as the file is stored. The queue lives on the
`videos` row itself, and the worker polls it every few seconds (`WORKER_POLL_MS`),
so editing starts almost immediately and survives restarts. Workers claim rows with
`FOR UPDATE SKIP LOCKED` and send heartbeats. If a worker dies, another one picks
its video up again.

## Quick start (offline, no accounts)

Needs Node.js 22.13+ and ffmpeg (`sudo apt install ffmpeg` or `brew install ffmpeg`).

```bash
cd sns-palace
npm install
cp .env.local.example .env.local
```

Edit `.env.local`: set `FAMILY_PIN`, `PARENT_PIN` (6+ digits) and
`SESSION_SECRET` (`openssl rand -base64 48`), and for a first try switch to the
local drivers:

```bash
DATABASE_DRIVER=local
STORAGE_DRIVER=local
TRANSCRIBER=none      # or set up local Whisper below for captions
```

Then run the app and the editing worker together:

```bash
npm run dev:all       # http://localhost:3000
npm run sample        # optional: makes data/samples/talking-demo.mp4 to upload
```

Open the app, type the family PIN, upload a video, then visit **Grown-ups**
(`/parent`) with the parent PIN to review and approve it.

## Adding the kids' devices

Open the parent room and press **Add a device**. It shows a QR code of the
address SnS Palace is running at; scan it with a tablet or phone on your home
Wi-Fi and it opens the PIN pad. If you opened SnS Palace as `localhost`, the
dialog explains that other devices need the computer's network address (such as
`http://192.168.1.20:3000`) and the code follows whichever address you use.

## Production setup: Supabase + Cloudinary

1. **Supabase**: create a project, open *SQL Editor*, paste
   [`supabase/schema.sql`](supabase/schema.sql) and run it. Copy the project URL
   and the service-role key (*Project Settings → API*; a new `sb_secret_…` key
   works too) into `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
2. **Cloudinary**: copy the cloud name, API key and secret (*Settings → API
   Keys*) into `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET`.
3. Set `DATABASE_DRIVER=supabase` and `STORAGE_DRIVER=cloudinary` (the defaults).
4. Build and run both processes on a machine with ffmpeg:

```bash
npm run build
npm run start:all     # next start + the worker; or run `npm start` and `npm run worker` separately
```

Every setting is documented in [`.env.local.example`](.env.local.example).
Both processes read the same `.env.local`. Run them from the `sns-palace/` folder.
The worker can live on a different machine (for example one with a GPU)
as long as it shares the same Supabase and Cloudinary settings.

### Captions: speech recognition

| `TRANSCRIBER` | What happens |
| --- | --- |
| `local` (default) | [faster-whisper](https://github.com/SYSTRAN/faster-whisper) runs on the worker machine; audio never leaves the house. `python3 -m venv worker/.venv && worker/.venv/bin/pip install -r worker/requirements.txt`, then `WHISPER_PYTHON=worker/.venv/bin/python`. The model (`WHISPER_MODEL`, default `base.en`) downloads from Hugging Face on first use. |
| `openai` | OpenAI's `whisper-1` API with word timestamps. Needs `OPENAI_API_KEY`, and sends each video's audio track to OpenAI. |
| `none` | No transcription: no captions, but silence trimming still works. |

If transcription fails or isn't installed, the video is still trimmed and
compressed. The parent review card says why there are no captions, and the
worker warns at startup when faster-whisper is missing.

## Security and privacy

- **Two PINs.** `FAMILY_PIN` opens the app; `PARENT_PIN` (separate, 6+ digits)
  opens `/parent` for `PARENT_SESSION_MINUTES`. The kids' PIN pad only ever
  grants family access, even if someone types the parent PIN into it.
- **Signed, HttpOnly, SameSite cookies** (HMAC-SHA256). The signing key mixes in
  `SESSION_SECRET` and the PIN, so changing either signs every device out.
- **Checked twice.** `src/proxy.ts` gates every page and API route (failing closed
  with a setup page if the PINs aren't configured), and every route handler
  re-checks the session itself. `/api/upload` is excluded from the proxy on
  purpose, because Next.js truncates request bodies over 10 MB that pass through
  a proxy, so it authenticates first thing in the handler.
- **Brute-force limits.** 5 wrong PINs locks a device out (1 minute, doubling up
  to an hour), and 20 wrong PINs household-wide in 15 minutes locks the pad for
  everyone, which also covers attackers rotating forged IP headers.
- **Private media.** Cloudinary assets use the `authenticated` delivery type,
  so nothing is reachable by URL. The server signs URLs per request and streams
  the bytes through `/api/media`, so signatures never reach a browser. Kids can
  only fetch the edit and thumbnail of approved videos.
- **Database lockdown.** Row Level Security is on with no policies, and the
  anon/authenticated roles have no grants. Only the server's service-role key
  can read or write.
- **Upload checks.** An allow-list of video types, a check of the file's first
  bytes (MP4/MOV/3GP, WebM/MKV, AVI) and a size cap enforced while streaming.
- **Location stripped.** Phone videos embed GPS coordinates; edited videos,
  previews and thumbnails are written without metadata.
- CSRF checks on every state change, `X-Frame-Options: DENY`,
  `Referrer-Policy: no-referrer`, `noindex` everywhere.

Serve it over HTTPS (a reverse proxy such as Caddy, or a VPN like Tailscale)
before reaching it from outside your home network.

## The editing pipeline

`worker/` holds the pipeline. The decisions are pure, unit-tested functions; the
ffmpeg commands are built by tested argument builders.

- **Silence trimming** (`worker/edit-plan.ts`). `silencedetect` finds stretches
  quieter than `SILENCE_NOISE_DB` lasting at least `SILENCE_MIN_SECONDS` (1.5 s).
  Recognised words are subtracted first, so a whispered word under the threshold
  is never cut. Each cut keeps `SILENCE_PADDING_SECONDS` of the pause next to
  speech, and a mostly quiet video (such as a silent Lego build) is left at full
  length instead of being trimmed to nothing.
- **Captions** (`worker/captions.ts`). Words are re-timed onto the edited
  timeline and grouped into short lines of a few big words in the lower third.
  They use the bundled rounded Fredoka Bold font (SIL OFL) with a thick outline,
  and the spoken word pops in a rainbow colour, karaoke style.
- **One render pass** (`worker/media.ts`). Trims, concatenation, scaling (to
  1280×720 or 720×1280, never upscaled), caption burn-in and EBU R128 loudness
  levelling run in a single filtergraph. The output is H.264/AAC MP4 with
  faststart, plus a VP9/Opus WebM copy for browsers without H.264
  (`OUTPUT_WEBM=false` to skip it). Players offer the MP4 first.
- **Transcripts** are stored in `transcript_json` with microsecond word timings,
  on both the raw and the edited timeline.
- **Retries.** Transient failures are retried (`WORKER_MAX_ATTEMPTS`); a file
  ffmpeg can't read fails once, with a reason the parent can read.
  `Ctrl-C` hands the current video back to the queue.

## API

All routes need a session cookie (from `POST /api/session`); parent routes need
the parent session.

| Method | Path | Who | Description |
| --- | --- | --- | --- |
| `POST` | `/api/session` | anyone | `{pin, mode: "family" \| "parent"}` → sets cookies; 429 with `Retry-After` when locked out |
| `GET` | `/api/session` | anyone | `{family, parent, parentExpiresAt}` |
| `DELETE` | `/api/session?scope=parent\|all` | anyone | Lock the parent room, or sign out |
| `POST` | `/api/upload` | family | Raw file body; headers `Content-Type`, `X-File-Name`, `X-Video-Title` (URI-encoded) → `201 {video: {id, title}}` |
| `GET` | `/api/videos` | family | `{videos, waitingCount, uploadLimitBytes}`: approved videos only |
| `GET` | `/api/videos?scope=all` | parent | Every video with pipeline state, analysis and transcript |
| `GET` | `/api/videos/:id` | family / parent | One video (kids: approved only) |
| `PATCH` | `/api/videos/:id` | parent | `{action: "approve" \| "unapprove" \| "reprocess"}` or `{action: "rename", title}` |
| `DELETE` | `/api/videos/:id` | parent | Deletes every stored file, then the row |
| `GET` | `/api/media/:id/:variant` | family / parent | `raw`, `preview`, `edited`, `webm`, `thumbnail`; supports `Range` |

## Project structure

```
sns-palace/
├── index.html, site/          # the GitHub Pages project page, screenshots and QR codes
├── supabase/schema.sql        # videos table, RLS lockdown, claim_next_video() queue function
├── .env.local.example         # every setting, documented
├── src/
│   ├── proxy.ts               # the household PIN gate
│   ├── app/                   # pages: / (kids), /unlock, /parent; api/* route handlers
│   ├── components/            # VideoPlayer, PinPad, kid/*, parent/*
│   ├── hooks/usePolling.ts
│   ├── lib/                   # shared types, API client, formatting (browser-safe)
│   └── server/                # config, auth, http helpers, db/ and storage/ drivers, DTOs
└── worker/
    ├── index.ts               # queue loop (npm run worker [-- --once])
    ├── pipeline.ts            # the six stages
    ├── edit-plan.ts           # cut planning and timeline remapping
    ├── captions.ts            # ASS caption generation
    ├── media.ts               # ffmpeg/ffprobe runner and command builders
    ├── transcribe.ts / .py    # faster-whisper and OpenAI transcribers
    ├── make-sample-video.sh   # npm run sample
    └── fonts/                 # Fredoka Bold + OFL licence
```

## Development

```bash
npm test             # unit + integration tests (the pipeline test renders real video with ffmpeg)
npm run lint
npm run typecheck
npm run build
```

`supabase/schema.test.ts` runs the real `schema.sql` in PGlite (PostgreSQL in
WebAssembly) to check the queue function, constraints and grants.

## Known limitations

- An upload is a single streaming request, and `next start` (Node's HTTP server)
  ends any request that takes longer than 5 minutes to arrive. That's plenty on
  home Wi-Fi, but very large files over a slow connection can time out. Resumable
  chunked uploads are a good Phase 2 step.
- The PIN lockout counters live in the web server's memory: a restart clears
  them, and several app instances don't share them.
- Media streams through the Next.js server (to keep Cloudinary URLs private),
  so the server's bandwidth is used for playback.
- The worker edits on the CPU; long 4K videos take a while.
