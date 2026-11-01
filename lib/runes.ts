import { query, queryOne } from "./db";
import { DEFAULT_REVERSAL_CHANCE } from "./runes-data";

export * from "./runes-data";

// Runes: a person draws one rune or several from the 24 of the Elder Futhark. The app picks them by chance with the
// person's own random method (Settings). A draw is one shared record (`divinations`, kind 'runes') plus one row per
// rune in `rune_draws` (migration 027). What each rune means to the person is kept in `card_customizations`, with
// every version in `card_meaning_revisions`, under ids like 'rune-fehu'. What the person makes of a draw is kept
// in `journals`, as for any reading.

/** The person's choice about upside-down runes. */
export interface RuneSettings {
  reversals: boolean;
  /** Out of 100: about how many runes land upside down, when reversals are on. */
  chance: number;
}

export async function getRuneSettings(userId: number): Promise<RuneSettings> {
  const row = await queryOne<{ runes_reversals: number | null; runes_reversal_chance: number | null }>(
    "SELECT runes_reversals, runes_reversal_chance FROM users WHERE id = $1",
    [userId]
  );
  return {
    reversals: row?.runes_reversals === 1,
    chance: row?.runes_reversal_chance ?? DEFAULT_REVERSAL_CHANCE,
  };
}

export async function saveRuneSettings(userId: number, settings: RuneSettings): Promise<void> {
  await query("UPDATE users SET runes_reversals = $1, runes_reversal_chance = $2 WHERE id = $3", [
    settings.reversals ? 1 : 0,
    settings.chance,
    userId,
  ]);
}

/** One rune in a draw, as it was drawn. */
export interface DrawnRune {
  rune_id: string;
  rune_name: string;
  reversed: boolean;
  /** What the position was called in the layout, as it was then. null for a draw with no layout. */
  position_name?: string | null;
  /** The person's own question for that position, while the layout still has it. */
  position_prompt?: string | null;
}

/** One draw of runes. `id` is the id of its shared record in `divinations`. */
export interface RuneDraw {
  id: number;
  question: string | null;
  /** JSON snapshot of the sky when the draw was made. */
  sky: string | null;
  created_at: string;
  /** The layout the draw used and its name as it was then. null for a draw with no layout. */
  layout_id: number | null;
  layout_name: string | null;
  runes: DrawnRune[];
  /** How many entries the person has written about this draw. */
  entry_count: number;
}

async function findDraws(userId: number, id?: number): Promise<RuneDraw[]> {
  const params: number[] = [userId];
  let sql = `
    SELECT d.id, d.question, d.sky, d.created_at, d.layout_id, d.layout_name,
           (SELECT COUNT(*)::int FROM journals j WHERE j.divination_id = d.id) AS entry_count
    FROM divinations d
    WHERE d.user_id = $1 AND d.kind = 'runes'`;
  if (id) sql += ` AND d.id = $${params.push(id)}`;
  sql += " ORDER BY d.created_at DESC, d.id DESC";
  const draws = await query<Omit<RuneDraw, "runes">>(sql, params);
  if (draws.length === 0) return [];

  const rows = await query<{
    divination_id: number; rune_id: string; rune_name: string; reversed: number;
    position_name: string | null; position_prompt: string | null;
  }>(
    `SELECT r.divination_id, r.rune_id, r.rune_name, r.reversed, r.position_name,
            (SELECT lp.prompt FROM layout_positions lp
             WHERE lp.layout_id = dv.layout_id AND lp.name = r.position_name LIMIT 1) AS position_prompt
     FROM rune_draws r JOIN divinations dv ON dv.id = r.divination_id
     WHERE r.user_id = $1 AND r.divination_id = ANY($2)
     ORDER BY r.sort_order ASC, r.id ASC`,
    [userId, draws.map((d) => d.id)]
  );
  return draws.map((d) => ({
    ...d,
    runes: rows
      .filter((r) => r.divination_id === d.id)
      .map((r) => ({
        rune_id: r.rune_id,
        rune_name: r.rune_name,
        reversed: r.reversed === 1,
        position_name: r.position_name,
        position_prompt: r.position_prompt,
      })),
  }));
}

/** The person's draws, newest first. */
export function listDraws(userId: number): Promise<RuneDraw[]> {
  return findDraws(userId);
}

/** One draw, or null when it is not theirs. */
export async function loadDraw(userId: number, id: number): Promise<RuneDraw | null> {
  if (!id) return null;
  return (await findDraws(userId, id))[0] ?? null;
}

/** The one-line summary kept on the shared record: the rune names in order, with "(reversed)" where one landed upside down. */
export function drawSummary(runes: { rune_name: string; reversed: boolean }[]): string {
  return runes.map((r) => r.rune_name + (r.reversed ? " (reversed)" : "")).join(", ");
}
