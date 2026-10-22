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
GitHub Pages. The app itself runs on your own computer, or online so it works
away from home too (see [Use it from anywhere](#use-it-from-anywhere)). The QR code comes as
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

### Put it on the home screen

SnS Palace can be installed like an app: it gets the castle icon and opens
without the browser's address bar.

- **iPhone and iPad (Safari):** open SnS Palace, tap **Share → Add to Home
  Screen**. An app added this way keeps its own sign-in, so type the family PIN
  once more the first time you open it from the home screen.
- **Android (Chrome):** tap **⋮ → Add to Home screen** (or **Install app**).
  Chrome only installs it as a full app over **https://**. On a plain
  `http://192.168…` address you get a shortcut that opens in a Chrome tab
  instead. To get HTTPS on your home network, put SnS Palace behind Tailscale
  (`tailscale serve`) or a reverse proxy such as Caddy.

`src/app/manifest.ts` describes the app (name, colours, icons), with the icons
in `public/icons/` and `src/app/apple-icon.png`. Browsers fetch these without
cookies, so they are the only files outside the PIN gate besides build assets.

## Use it from anywhere

On your own computer, SnS Palace only works while that computer is on, and only
on your home Wi-Fi. Put it on a hosting service instead and it runs around the
clock at its own `https://` address: kids can post from a grandparent's house,
you can post for them from work, and everyone sees new videos on any Wi-Fi or
mobile data with the home computer switched off.

The [`Dockerfile`](Dockerfile) packs the web app, the editing worker, ffmpeg
and on-device speech recognition into one container, and keeps everything (the
database, the videos and the speech model) on a disk mounted at `/data`. No
Supabase or Cloudinary account is needed.

### One click: Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Kevdogg05/kevdogg05.github.io)

1. Press the button and sign in to [Render](https://render.com) with GitHub.
   Render reads [`render.yaml`](../render.yaml) at the top of this repository: one
   web service called `sns-palace` with a 10 GB disk.
2. Type a `FAMILY_PIN` and a `PARENT_PIN` when asked. Anyone on the internet
   can reach the PIN pad, so use **6 or more digits for both**, and two
   different PINs. `SESSION_SECRET` is generated for you.
3. Press **Deploy Blueprint**. The paid plan needs a card on file. The first
   build takes about 10 minutes.
4. Open the address Render shows (something like
   `https://sns-palace-ab12.onrender.com`) and type the family PIN. Then open
   **Grown-ups → Add a device** and scan the code with each tablet and phone.
   Over https, Android installs it as a full app too.

**Cost** (Render's prices in October 2026): the Standard instance (2 GB memory,
1 CPU) is $25 a month and the 10 GB disk $2.50, so about **$27.50 a month**.
Editing a video and recognising its speech need about 1 GB on top of the app,
so the $7 Starter instance (512 MB) runs out of memory while editing.

- **Updates:** every change pushed to `sns-palace/` on `main` redeploys on its
  own. SnS Palace is offline for a minute or two while it restarts.
- **Backups:** Render snapshots the disk every day; restore one from the
  service's **Disks** page.
- **More room:** raise the disk size on the same page. Disks can grow but never
  shrink.
- **Region:** `render.yaml` uses Oregon (US West). To host it nearer home, change
  `region:` before the first deploy. It can't be moved afterwards.

### Cheaper: Railway (about $5 a month)

[Railway](https://railway.com) bills for the memory and CPU the container
actually uses, and its $5-a-month Hobby plan includes $5 of use. SnS Palace
idles at about 250 MB, so a family's videos usually fit inside that. Two catches:
a Hobby disk (volume) holds at most 5 GB, roughly 50 to 100 phone clips with
their edits, and requests are capped at 15 minutes, which limits very big
uploads on slow connections.

1. **New Project → Deploy from GitHub repo**, and pick this repository.
2. In the service's **Settings**, set **Root Directory** to `sns-palace`.
   Railway finds the Dockerfile there.
3. Under **Variables**, add `FAMILY_PIN`, `PARENT_PIN` (6+ digits each) and
   `SESSION_SECRET` (`openssl rand -base64 48`).
4. Add a **volume** to the service, mounted at `/data`.
5. Under **Settings → Networking**, press **Generate Domain** and open it.

### Anywhere else with Docker

Any machine with Docker and at least 2 GB of memory can run the same image: a
VPS, a NAS, or a computer you leave on.

```bash
docker build -t sns-palace .
docker run -d --restart unless-stopped -p 3000:3000 -v sns-palace-data:/data \
  -e FAMILY_PIN=... -e PARENT_PIN=... -e SESSION_SECRET=... sns-palace
```

Pass the settings one by one rather than with `--env-file .env.local`. Your
home `.env.local` points `LOCAL_DATA_DIR` and `WHISPER_PYTHON` at folders on your
computer, and inside the container the videos must go to `/data`. Put HTTPS in
front before opening it to the internet, for example with Caddy, a Cloudflare
Tunnel or Tailscale Funnel.

### Good to know

- **Videos already on your computer stay there.** The online copy starts empty;
  upload the ones you want again.
- **Captions** use faster-whisper inside the container. The `base.en` model
  (about 150 MB) downloads into `/data/models` the first time a video is edited.
  To use OpenAI instead, set `TRANSCRIBER=openai` and `OPENAI_API_KEY`.
- **Supabase and Cloudinary** still work online: set `DATABASE_DRIVER`,
  `STORAGE_DRIVER` and their keys as in
  [Production setup](#production-setup-supabase--cloudinary). Keep the disk
  anyway for the speech model, or it downloads again after every restart.
- **Uploads** in the container may take up to an hour to arrive
  (`UPLOAD_TIMEOUT_MINUTES`, default 60), so a long video over mobile data still
  gets through.
- **The container** runs as an unprivileged user, caps ffmpeg at two threads
  (`FFMPEG_THREADS`), and restarts as a whole if the app or the worker stops.

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
  everyone, which also covers attackers rotating forged IP headers. On top of
  that, the pad takes at most 100 wrong PINs in any 24 hours, so guessing a
  6-digit PIN online would take over ten years on average. Devices that are already unlocked keep
  working during a lockout.
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
  `Referrer-Policy: no-referrer`, `noindex` everywhere, and HSTS once it is
  served over HTTPS.

Serve it over HTTPS before reaching it from outside your home network. The
hosting options in [Use it from anywhere](#use-it-from-anywhere) do that for
you; on your own machine, use a reverse proxy such as Caddy or a VPN like
Tailscale. Session cookies are marked `Secure` whenever the site is served over
HTTPS.

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
├── Dockerfile, docker/        # the one-container image: web app + worker + ffmpeg + faster-whisper
├── supabase/schema.sql        # videos table, RLS lockdown, claim_next_video() queue function
├── .env.local.example         # every setting, documented
├── src/
│   ├── proxy.ts               # the household PIN gate
│   ├── app/                   # pages: / (kids), /unlock, /parent; api/* route handlers; manifest.ts
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

- An upload is a single streaming request. `npm start` (Node's HTTP server)
  ends any request that takes longer than 5 minutes to arrive. The Docker image
  raises that to an hour, though a host can cap it lower (Railway: 15 minutes).
  If the connection drops, the upload starts over. Resumable chunked uploads
  are a good Phase 2 step.
- The PIN lockout counters live in the web server's memory: a restart clears
  them, and several app instances don't share them.
- Media streams through the Next.js server (to keep Cloudinary URLs private),
  so the server's bandwidth is used for playback.
- The worker edits on the CPU; long 4K videos take a while.
