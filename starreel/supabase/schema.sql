-- StarReel database schema for Supabase (PostgreSQL 15+).
--
-- Run it once in the Supabase dashboard (SQL Editor → New query → paste → Run),
-- or with the CLI: supabase db execute --file supabase/schema.sql
-- It is idempotent, so re-running it after an upgrade is safe.
--
-- Security model: the browser never talks to Supabase. Only the Next.js server
-- and the editing worker connect, using the service-role (secret) key. Row Level
-- Security is enabled with no policies, so the public anon key can read nothing.

-- Review state a parent controls. Only 'approved' videos reach the kids' feed.
do $$ begin
  create type public.video_status as enum ('pending', 'approved');
exception when duplicate_object then null; end $$;

-- Where the automatic editing pipeline is for a video.
do $$ begin
  create type public.pipeline_status as enum ('queued', 'processing', 'ready', 'failed');
exception when duplicate_object then null; end $$;

create table if not exists public.videos (
  id              uuid primary key default gen_random_uuid(),
  title           text not null check (char_length(title) between 1 and 80),
  status          public.video_status not null default 'pending',

  -- Storage URLs as reported by the storage provider (Cloudinary secure_url).
  -- Assets are private ("authenticated" delivery type); the app streams them
  -- to signed-in household members through /api/media and never exposes these.
  raw_url         text not null,
  edited_url      text,
  thumbnail_url   text,

  -- Word-level transcript: {engine, model, language, text, words, edited_words};
  -- each word is {text, start_us, end_us, probability} in microseconds.
  transcript_json jsonb,
  created_at      timestamptz not null default now(),

  -- Storage keys the app uses to sign, serve and delete each asset.
  raw_key         text not null,
  preview_key     text,  -- browser-safe copy of the raw upload, for side-by-side review
  edited_key      text,  -- H.264/AAC MP4: plays everywhere
  edited_webm_key text,  -- the same edit as VP9/Opus WebM, for browsers without H.264
  thumbnail_key   text,
  original_filename text,
  content_type    text,
  size_bytes      bigint check (size_bytes >= 0),

  -- Pipeline bookkeeping (a small job queue on the same row).
  pipeline_status public.pipeline_status not null default 'queued',
  pipeline_stage  text,
  pipeline_error  text,
  attempts        integer not null default 0 check (attempts >= 0),
  locked_by       text,
  locked_at       timestamptz,
  -- Durations, cut list, word count, warnings and timings from the last edit.
  analysis        jsonb,

  updated_at      timestamptz not null default now(),
  approved_at     timestamptz
);

create index if not exists videos_feed_idx
  on public.videos (approved_at desc) where status = 'approved';
create index if not exists videos_queue_idx
  on public.videos (created_at) where pipeline_status in ('queued', 'processing');
create index if not exists videos_created_idx on public.videos (created_at desc);

-- Keep updated_at current on every change.
create or replace function public.videos_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists videos_touch_updated_at on public.videos;
create trigger videos_touch_updated_at
  before update on public.videos
  for each row execute function public.videos_touch_updated_at();

-- Lock the table down: no access through the public anon or authenticated roles.
alter table public.videos enable row level security;
revoke all on table public.videos from anon, authenticated;
grant select, insert, update, delete on table public.videos to service_role;

-- Atomically hand the oldest waiting video to a worker.
--
-- A video is claimable when it is queued, or when its worker stopped sending
-- heartbeats (locked_at older than p_stale_after_seconds) and it has attempts
-- left. Videos that went stale on their last attempt are marked failed first.
-- FOR UPDATE SKIP LOCKED lets several workers poll without double-claiming.
create or replace function public.claim_next_video(
  p_worker_id text,
  p_stale_after_seconds integer default 300,
  p_max_attempts integer default 3
)
returns setof public.videos
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.videos
     set pipeline_status = 'failed',
         pipeline_error = 'The editing worker stopped responding too many times.',
         locked_by = null,
         locked_at = null
   where pipeline_status = 'processing'
     and locked_at < now() - make_interval(secs => p_stale_after_seconds)
     and attempts >= p_max_attempts;

  return query
  update public.videos v
     set pipeline_status = 'processing',
         pipeline_stage = 'probe',
         pipeline_error = null,
         attempts = v.attempts + 1,
         locked_by = p_worker_id,
         locked_at = now()
   where v.id = (
     select c.id
       from public.videos c
      where c.attempts < p_max_attempts
        and (
          c.pipeline_status = 'queued'
          or (c.pipeline_status = 'processing'
              and c.locked_at < now() - make_interval(secs => p_stale_after_seconds))
        )
      order by c.created_at
      for update skip locked
      limit 1
   )
  returning v.*;
end;
$$;

revoke all on function public.claim_next_video(text, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_next_video(text, integer, integer) to service_role;
