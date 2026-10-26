// Supabase (PostgreSQL) driver. Server-side only: it uses the service-role key,
// which bypasses Row Level Security. See supabase/schema.sql.

import { createClient, type PostgrestError, type SupabaseClient } from "@supabase/supabase-js";
import type { VideoRecord, VideoStatus } from "@/lib/types";
import type {
  ClaimOptions,
  NewVideo,
  UpdateCondition,
  VideoPatch,
  VideoRepository,
} from "@/server/db/repository";

const TABLE = "videos";

function check<T>(result: { data: T; error: PostgrestError | null }, action: string): T {
  if (result.error) {
    throw new Error(`Supabase could not ${action}: ${result.error.message}`, { cause: result.error });
  }
  return result.data;
}

export class SupabaseVideoRepository implements VideoRepository {
  readonly driver = "supabase" as const;
  private readonly client: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { "x-application-name": "sns-palace" } },
    });
  }

  private get table() {
    return this.client.from(TABLE);
  }

  async create(video: NewVideo): Promise<VideoRecord> {
    return check(await this.table.insert(video).select().single(), "save the upload") as VideoRecord;
  }

  async get(id: string): Promise<VideoRecord | null> {
    return check(await this.table.select("*").eq("id", id).maybeSingle(), "load a video") as VideoRecord | null;
  }

  async list(options: { status?: VideoStatus; limit?: number } = {}): Promise<VideoRecord[]> {
    let query = this.table.select("*");
    if (options.status) query = query.eq("status", options.status);
    const orderBy = options.status === "approved" ? "approved_at" : "created_at";
    const result = await query.order(orderBy, { ascending: false }).limit(options.limit ?? 200);
    return check(result, "list videos") as VideoRecord[];
  }

  async countPending(): Promise<number> {
    const result = await this.table.select("id", { count: "exact", head: true }).eq("status", "pending");
    check(result, "count videos");
    return result.count ?? 0;
  }

  async update(id: string, patch: VideoPatch, condition: UpdateCondition = {}): Promise<VideoRecord | null> {
    let query = this.table.update(patch).eq("id", id);
    if (condition.lockedBy !== undefined) query = query.eq("locked_by", condition.lockedBy);
    if (condition.pipelineStatusIn?.length) query = query.in("pipeline_status", condition.pipelineStatusIn);
    return check(await query.select().maybeSingle(), "update a video") as VideoRecord | null;
  }

  async delete(id: string): Promise<VideoRecord | null> {
    return check(
      await this.table.delete().eq("id", id).select().maybeSingle(),
      "delete a video",
    ) as VideoRecord | null;
  }

  async claimNext({ workerId, staleSeconds, maxAttempts }: ClaimOptions): Promise<VideoRecord | null> {
    const result = await this.client.rpc("claim_next_video", {
      p_worker_id: workerId,
      p_stale_after_seconds: staleSeconds,
      p_max_attempts: maxAttempts,
    });
    const rows = check(result, "claim the next video") as VideoRecord[] | null;
    return rows?.[0] ?? null;
  }
}
