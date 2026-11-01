// A person's hidden shared archetype links (migration 073), in the database. Server code only. Every query is for one person
// (`userId` from the session). The rules and shapes are in lib/hidden-links-core.ts.

import { query, queryOne } from "./db";
import { MAX_HIDDEN, NO_HIDDEN, hiddenKey, type HiddenSet } from "./hidden-links-core";

/** Everything this person hid. */
export async function loadHidden(userId: number): Promise<HiddenSet> {
  const rows = await query<{ symbol_id: string; slug: string }>(
    "SELECT h.symbol_id, a.slug FROM user_hidden_links h JOIN archetypes a ON a.id = h.archetype_id WHERE h.user_id = $1",
    [userId]
  );
  return rows.length ? new Set(rows.map((r) => hiddenKey(r.symbol_id, r.slug))) : NO_HIDDEN;
}

export type SetHiddenResult = "ok" | "no-archetype" | "limit";

/** Hides (`hidden` true) or shows again one link of one piece for this person. Hiding twice or showing what was not hidden is not an error. */
export async function setHidden(userId: number, symbolId: string, slug: string, hidden: boolean): Promise<SetHiddenResult> {
  const a = await queryOne<{ id: number }>("SELECT id FROM archetypes WHERE slug = $1", [slug]);
  if (!a) return "no-archetype";
  if (!hidden) {
    await query("DELETE FROM user_hidden_links WHERE user_id = $1 AND symbol_id = $2 AND archetype_id = $3", [userId, symbolId, a.id]);
    return "ok";
  }
  const n = await queryOne<{ n: string }>("SELECT COUNT(*) AS n FROM user_hidden_links WHERE user_id = $1", [userId]);
  if (Number(n?.n ?? 0) >= MAX_HIDDEN) return "limit";
  await query(
    "INSERT INTO user_hidden_links (user_id, symbol_id, archetype_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
    [userId, symbolId, a.id]
  );
  return "ok";
}

/** For the data export: what this person hid, newest first. */
export async function hiddenForExport(userId: number): Promise<{ symbol_id: string; archetype: string; created_at: string }[]> {
  return query(
    `SELECT h.symbol_id, a.slug AS archetype, h.created_at
       FROM user_hidden_links h JOIN archetypes a ON a.id = h.archetype_id
      WHERE h.user_id = $1 ORDER BY h.created_at DESC, h.symbol_id`,
    [userId]
  );
}
