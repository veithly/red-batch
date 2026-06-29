import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Cloudflare D1 access layer.
 *
 * Red Batch's owned operational store. Locally and in production this is a
 * Cloudflare D1 (SQLite) database bound as `DB` via OpenNext. The schema lives
 * in `migrations/0001_init.sql` and is applied with `wrangler d1 migrations
 * apply`. All reads/writes go through the async helpers below so the rest of
 * the app never touches the binding directly.
 */
export function getDb(): D1Database {
  const { env } = getCloudflareContext();
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new Error("D1 binding 'DB' is not configured (set d1_databases in wrangler.jsonc)");
  return db;
}

function stmt(sql: string, params: unknown[]): D1PreparedStatement {
  const s = getDb().prepare(sql);
  return params.length ? s.bind(...params) : s;
}

/** First row or undefined. */
export async function q1<T>(sql: string, ...params: unknown[]): Promise<T | undefined> {
  const row = await stmt(sql, params).first<Record<string, unknown>>();
  return (row ?? undefined) as T | undefined;
}

/** All rows. */
export async function qAll<T>(sql: string, ...params: unknown[]): Promise<T[]> {
  const res = await stmt(sql, params).all<Record<string, unknown>>();
  return (res.results ?? []) as unknown as T[];
}

/** INSERT/UPDATE/DELETE. */
export async function run(sql: string, ...params: unknown[]): Promise<void> {
  await stmt(sql, params).run();
}
