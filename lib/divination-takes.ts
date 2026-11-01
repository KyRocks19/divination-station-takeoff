// The takes on divination a person kept (migration 098), in the database. Server code only. Every query is for one person
// (`userId` from the session). The takes and the rules are in lib/divination-takes-core.ts.

import { query, queryOne } from "./db";
import { MAX_KEPT_TAKES, MAX_OWN_TAKES, isTakeId, type OwnTake } from "./divination-takes-core";

/** The ids this person kept, newest first. Ids no longer in the list are left out. */
export async function keptTakeIds(userId: number): Promise<string[]> {
  const rows = await query<{ take_id: string }>("SELECT take_id FROM user_divination_takes WHERE user_id = $1 ORDER BY created_at DESC, take_id", [userId]);
  return rows.map((r) => r.take_id).filter(isTakeId);
}

export type KeepResult = "ok" | "limit" | "unavailable";

/** Keeps (`kept` true) or lets go of one take for this person. Keeping twice, or letting go of one not kept, is not an error. */
export async function setTakeKept(userId: number, takeId: string, kept: boolean): Promise<KeepResult> {
  if (!kept) {
    await query("DELETE FROM user_divination_takes WHERE user_id = $1 AND take_id = $2", [userId, takeId]);
    return "ok";
  }
  const n = await queryOne<{ n: string }>("SELECT COUNT(*) AS n FROM user_divination_takes WHERE user_id = $1", [userId]);
  if (Number(n?.n ?? 0) >= MAX_KEPT_TAKES) return "limit";
  await query("INSERT INTO user_divination_takes (user_id, take_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [userId, takeId]);
  return "ok";
}

/** For the data export: what this person kept, newest first. */
export async function keptTakesForExport(userId: number): Promise<{ take_id: string; created_at: string }[]> {
  return await query("SELECT take_id, created_at FROM user_divination_takes WHERE user_id = $1 ORDER BY created_at DESC, take_id", [userId]);
}

// ---------------------------------------------------------------- the person's own takes

/** The takes this person wrote, oldest first. */
export async function listOwnTakes(userId: number): Promise<OwnTake[]> {
  return await query<OwnTake>("SELECT id, text, created_at FROM user_own_takes WHERE user_id = $1 ORDER BY created_at, id", [userId]);
}

export type AddResult = { ok: true; take: OwnTake } | { ok: false; error: "limit" | "unavailable" };

/** Adds one take this person wrote; `text` is already cleaned (cleanOwnTake). */
export async function addOwnTake(userId: number, text: string): Promise<AddResult> {
  const n = await queryOne<{ n: string }>("SELECT COUNT(*) AS n FROM user_own_takes WHERE user_id = $1", [userId]);
  if (Number(n?.n ?? 0) >= MAX_OWN_TAKES) return { ok: false, error: "limit" };
  const take = await queryOne<OwnTake>("INSERT INTO user_own_takes (user_id, text) VALUES ($1, $2) RETURNING id, text, created_at", [userId, text]);
  return take ? { ok: true, take } : { ok: false, error: "unavailable" };
}

/** Deletes one of this person's own takes. False when they have no take with that id. */
export async function deleteOwnTake(userId: number, id: number): Promise<boolean> {
  const row = await queryOne<{ id: number }>("DELETE FROM user_own_takes WHERE user_id = $1 AND id = $2 RETURNING id", [userId, id]);
  return !!row;
}
