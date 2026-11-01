import { query } from "./db";
import { namesById } from "./own-names-core";

// A person's own names for pieces of the tools (migration 076). Every query is for one person. Server code only.

/** The person's names as a lookup by piece id. */
export async function ownNames(userId: number, pieceIds?: string[]): Promise<Record<string, string>> {
  const rows = pieceIds
    ? await query<{ piece_id: string; name: string }>("SELECT piece_id, name FROM symbol_own_names WHERE user_id = $1 AND piece_id = ANY($2)", [userId, pieceIds])
    : await query<{ piece_id: string; name: string }>("SELECT piece_id, name FROM symbol_own_names WHERE user_id = $1", [userId]);
  return namesById(rows);
}

/** Saves a name, replacing the one there. */
export async function saveOwnName(userId: number, pieceId: string, name: string): Promise<void> {
  await query(
    `INSERT INTO symbol_own_names (user_id, piece_id, name) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, piece_id) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()`,
    [userId, pieceId, name]
  );
}

/** Removes a name. */
export async function removeOwnName(userId: number, pieceId: string): Promise<void> {
  await query("DELETE FROM symbol_own_names WHERE user_id = $1 AND piece_id = $2", [userId, pieceId]);
}
