import { query } from "./db";

export * from "./dice-data";

// Dice and coins: a person throws a coin or dice. The app picks each face by chance with the person's own random
// method (Settings), with replacement, so the same face can come up twice. A throw is one shared record
// (`divinations`, kind 'dice') plus one row per result in `dice_throws` (migration 030). What each face means to the
// person is kept in `card_customizations`, with every version in `card_meaning_revisions`, under ids like 'die-d6-3'
// and 'coin-heads'. What the person makes of a throw is kept in `journals`, as for any reading.

import type { DiceObjectId } from "./dice-data";

/** One result in a throw. */
export interface ThrowResult {
  /** What was thrown for this result. A throw can have several kinds of object. */
  object: DiceObjectId;
  face: string;
  /** What the position was called in the layout, as it was then. null for a throw with no layout. */
  position_name: string | null;
  /** The person's own question for that position, while the layout still has it. */
  position_prompt: string | null;
}

/** One throw. `id` is the id of its shared record in `divinations`. */
export interface DiceThrow {
  id: number;
  question: string | null;
  /** JSON snapshot of the sky when the throw was made. */
  sky: string | null;
  created_at: string;
  /** The layout the throw used and its name as it was then. null for a throw with no layout. */
  layout_id: number | null;
  layout_name: string | null;
  results: ThrowResult[];
  /** How many entries the person has written about this throw. */
  entry_count: number;
}

async function findThrows(userId: number, id?: number): Promise<DiceThrow[]> {
  const params: number[] = [userId];
  let sql = `
    SELECT d.id, d.question, d.sky, d.created_at, d.layout_id, d.layout_name,
           (SELECT COUNT(*)::int FROM journals j WHERE j.divination_id = d.id) AS entry_count
    FROM divinations d
    WHERE d.user_id = $1 AND d.kind = 'dice'`;
  if (id) sql += ` AND d.id = $${params.push(id)}`;
  sql += " ORDER BY d.created_at DESC, d.id DESC";
  const throws = await query<Omit<DiceThrow, "results">>(sql, params);
  if (throws.length === 0) return [];

  const rows = await query<{
    divination_id: number; object: DiceObjectId; face: string;
    position_name: string | null; position_prompt: string | null;
  }>(
    `SELECT t.divination_id, t.object, t.face, t.position_name,
            (SELECT lp.prompt FROM layout_positions lp
             WHERE lp.layout_id = dv.layout_id AND lp.name = t.position_name LIMIT 1) AS position_prompt
     FROM dice_throws t JOIN divinations dv ON dv.id = t.divination_id
     WHERE t.user_id = $1 AND t.divination_id = ANY($2)
     ORDER BY t.sort_order ASC, t.id ASC`,
    [userId, throws.map((t) => t.id)]
  );
  return throws.map((t) => {
    const mine = rows.filter((r) => r.divination_id === t.id);
    return {
      ...t,
      results: mine.map((r) => ({ object: r.object, face: r.face, position_name: r.position_name, position_prompt: r.position_prompt })),
    };
  });
}

/** The person's throws, newest first. */
export function listThrows(userId: number): Promise<DiceThrow[]> {
  return findThrows(userId);
}

/** One throw, or null when it is not theirs. */
export async function loadThrow(userId: number, id: number): Promise<DiceThrow | null> {
  if (!id) return null;
  return (await findThrows(userId, id))[0] ?? null;
}
