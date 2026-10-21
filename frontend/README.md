# OpenAvatarStudio: frontend

Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 dashboard for
OpenAvatarStudio. See the [root README](../README.md) for the full project.

```bash
npm install
npm run dev        # http://localhost:3000, expects the backend on :8000
```

Set `NEXT_PUBLIC_API_URL` in `.env.local` if the backend runs somewhere other
than port 8000 on the same host.

| Path | What it holds |
| --- | --- |
| `src/components/studio/` | Dashboard UI: script editor, voice selector, avatar uploader, preview player, pipeline steps, control bar |
| `src/hooks/` | `useBackend` (health + voices), `useAvatarUpload`, `useGenerationJob` (polling) |
| `src/lib/api.ts` | Typed client for the FastAPI backend |
