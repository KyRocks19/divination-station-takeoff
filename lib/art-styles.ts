import { query, queryOne } from "./db";
import { MAX_ART_STYLES, type SavedStyle } from "./art-styles-core";

// The picture-maker's saved style notes (migration 078): one note a person saves for a set, and a list of their own named styles. Every query is
// for one person. Server code only; the browser uses lib/art-styles-core.ts.

export async function listStyles(userId: number): Promise<SavedStyle[]> {
  return query<SavedStyle>("SELECT id, name, text FROM art_styles WHERE user_id = $1 ORDER BY created_at, id", [userId]);
}

/** The style note saved for one of the person's sets, or null. */
export async function deckStyle(userId: number, deckId: number): Promise<string | null> {
  const row = await queryOne<{ art_style: string | null }>("SELECT art_style FROM oracle_decks WHERE id = $1 AND user_id = $2", [deckId, userId]);
  return row?.art_style ?? null;
}

/** Saves (or with null, clears) a set's style note. "none": not the person's set. */
export async function setDeckStyle(userId: number, deckId: number, style: string | null): Promise<"ok" | "none"> {
  const row = await queryOne("UPDATE oracle_decks SET art_style = $3 WHERE id = $1 AND user_id = $2 RETURNING id", [deckId, userId, style]);
  return row ? "ok" : "none";
}

/** Saves a named style. "limit": the person has the most they may keep; "duplicate": the name is taken (ignoring capitals). */
export async function createStyle(userId: number, name: string, text: string): Promise<{ ok: true; style: SavedStyle } | { ok: false; problem: "limit" | "duplicate" }> {
  try {
    const n = await queryOne<{ n: number }>("SELECT COUNT(*)::int AS n FROM art_styles WHERE user_id = $1", [userId]);
    if ((n?.n ?? 0) >= MAX_ART_STYLES) return { ok: false, problem: "limit" };
    const row = await queryOne<SavedStyle>("INSERT INTO art_styles (user_id, name, text) VALUES ($1, $2, $3) RETURNING id, name, text", [userId, name, text]);
    return { ok: true, style: row! };
  } catch (err) {
    if ((err as { code?: string })?.code === "23505") return { ok: false, problem: "duplicate" };
    throw err;
  }
}

export async function deleteStyle(userId: number, id: number): Promise<boolean> {
  return !!(await queryOne("DELETE FROM art_styles WHERE id = $1 AND user_id = $2 RETURNING id", [id, userId]));
}
