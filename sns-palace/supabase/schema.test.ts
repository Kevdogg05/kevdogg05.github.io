import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

// Runs the real schema.sql in PGlite (PostgreSQL compiled to WASM), with stub
// versions of the roles Supabase provides.
const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role;");
  await db.exec(schema);
});

beforeEach(async () => {
  await db.exec("truncate videos");
});

async function insert(title: string, minutesAgo: number) {
  await db.query(
    `insert into videos (title, raw_url, raw_key, created_at)
     values ($1, 'https://example.test/raw', $2, now() - make_interval(mins => $3))`,
    [title, `raw/${title}.mp4`, minutesAgo],
  );
}

async function claim(worker: string) {
  const result = await db.query<{ title: string; attempts: number; locked_by: string }>(
    "select title, attempts, locked_by from claim_next_video($1, 300, 3)",
    [worker],
  );
  return result.rows;
}

describe("supabase/schema.sql", () => {
  it("is idempotent", async () => {
    await expect(db.exec(schema)).resolves.toBeDefined();
  });

  it("claims the oldest queued video once", async () => {
    await insert("newer", 1);
    await insert("older", 2);

    expect(await claim("w1")).toEqual([{ title: "older", attempts: 1, locked_by: "w1" }]);
    expect(await claim("w2")).toEqual([{ title: "newer", attempts: 1, locked_by: "w2" }]);
    expect(await claim("w3")).toEqual([]);
  });

  it("reclaims a video whose worker went quiet, then gives up after the last attempt", async () => {
    await insert("clip", 5);
    await claim("w1");

    await db.exec("update videos set locked_at = now() - interval '10 minutes'");
    expect(await claim("w2")).toEqual([{ title: "clip", attempts: 2, locked_by: "w2" }]);

    await db.exec("update videos set locked_at = now() - interval '10 minutes', attempts = 3");
    expect(await claim("w3")).toEqual([]);

    const row = await db.query<{ pipeline_status: string; locked_by: string | null }>(
      "select pipeline_status, locked_by from videos",
    );
    expect(row.rows[0]).toEqual({ pipeline_status: "failed", locked_by: null });
  });

  it("does not steal a video from a worker that is still heartbeating", async () => {
    await insert("clip", 5);
    await claim("w1");
    expect(await claim("w2")).toEqual([]);
  });

  it("touches updated_at and enforces column checks", async () => {
    await insert("clip", 5);
    await db.exec("update videos set title = 'renamed'");
    const touched = await db.query<{ touched: boolean }>(
      "select updated_at > created_at as touched from videos",
    );
    expect(touched.rows[0].touched).toBe(true);

    await expect(
      db.query("insert into videos (title, raw_url, raw_key) values ('', 'u', 'k')"),
    ).rejects.toThrow(/check constraint/);
    await expect(
      db.query("update videos set status = 'published'"),
    ).rejects.toThrow(/invalid input value for enum/);
  });

  it("keeps the table and claim function away from the public roles", async () => {
    const grants = await db.query<{ grantee: string }>(
      `select distinct grantee from information_schema.role_table_grants
        where table_name = 'videos' order by grantee`,
    );
    const grantees = grants.rows.map((row) => row.grantee);
    expect(grantees).toContain("service_role");
    expect(grantees).not.toContain("anon");
    expect(grantees).not.toContain("authenticated");

    const rls = await db.query<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class where relname = 'videos'",
    );
    expect(rls.rows[0].relrowsecurity).toBe(true);

    const exec = await db.query<{ anon: boolean; service: boolean }>(
      `select has_function_privilege('anon', 'claim_next_video(text,integer,integer)', 'execute') as anon,
              has_function_privilege('service_role', 'claim_next_video(text,integer,integer)', 'execute') as service`,
    );
    expect(exec.rows[0]).toEqual({ anon: false, service: true });
  });
});
