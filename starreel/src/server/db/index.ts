import { getDatabaseConfig } from "@/server/config";
import type { VideoRepository } from "@/server/db/repository";

export type { VideoRepository } from "@/server/db/repository";

// One repository per process, kept on globalThis so dev hot reloads reuse it.
const globalForDb = globalThis as typeof globalThis & { __starreelRepository?: Promise<VideoRepository> };

/** The configured database driver. Drivers load lazily so unused ones cost nothing. */
export function getRepository(): Promise<VideoRepository> {
  globalForDb.__starreelRepository ??= (async () => {
    const config = getDatabaseConfig();
    if (config.driver === "supabase") {
      const { SupabaseVideoRepository } = await import("@/server/db/supabase");
      return new SupabaseVideoRepository(config.url, config.serviceRoleKey);
    }
    const { SqliteVideoRepository } = await import("@/server/db/sqlite");
    return new SqliteVideoRepository(config.file);
  })().catch((error) => {
    globalForDb.__starreelRepository = undefined; // let the next request retry
    throw error;
  });
  return globalForDb.__starreelRepository;
}
