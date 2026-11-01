import { query, queryOne } from "./db";

export * from "./ogham-data";

// Ogham: a person draws one stave or several from the 20 ogham letters, or 25 with the five later letters. The app
// picks them by chance with the person's own random method (Settings). A draw is one shared record (`divinations`,
// kind 'ogham') plus one row per stave in `ogham_draws` (migration 028). What each stave means to the person is kept
// in `card_customizations`, with every version in `card_meaning_revisions`, under ids like 'ogham-beith'. What the
// person makes of a draw is kept in `journals`, as for any reading. Staves never land upside down.

/** The person's choices about the five later letters: whether draws include them, and whether draws show their later names. */
export interface OghamSettings {
  forfeda: boolean;
  laterNames: boolean;
}

export async function getOghamSettings(userId: number): Promise<OghamSettings> {
  const row = await queryOne<{ ogham_forfeda: number | null; ogham_later_names: number | null }>(
    "SELECT ogham_forfeda, ogham_later_names FROM users WHERE id = $1",
    [userId]
  );
  return { forfeda: row?.ogham_forfeda === 1, laterNames: row?.ogham_later_names === 1 };
}

export async function saveOghamSettings(userId: number, settings: OghamSettings): Promise<void> {
  await query("UPDATE users SET ogham_forfeda = $1, ogham_later_names = $2 WHERE id = $3", [settings.forfeda ? 1 : 0, settings.laterNames ? 1 : 0, userId]);
}

/** One stave in a draw, as it was drawn. */
export interface DrawnStave {
  stave_id: string;
  stave_name: string;
  /** What the position was called in the layout, as it was then. null for a draw with no layout. */
  position_name?: string | null;
  /** The person's own question for that position, while the layout still has it. */
  position_prompt?: string | null;
}

/** One draw of staves. `id` is the id of its shared record in `divinations`. */
export interface OghamDraw {
  id: number;
  question: string | null;
  /** JSON snapshot of the sky when the draw was made. */
  sky: string | null;
  created_at: string;
  /** The layout the draw used and its name as it was then. null for a draw with no layout. */
  layout_id: number | null;
  layout_name: string | null;
  staves: DrawnStave[];
  /** How many entries the person has written about this draw. */
  entry_count: number;
}

async function findDraws(userId: number, id?: number): Promise<OghamDraw[]> {
  const params: number[] = [userId];
  let sql = `
    SELECT d.id, d.question, d.sky, d.created_at, d.layout_id, d.layout_name,
           (SELECT COUNT(*)::int FROM journals j WHERE j.divination_id = d.id) AS entry_count
    FROM divinations d
    WHERE d.user_id = $1 AND d.kind = 'ogham'`;
  if (id) sql += ` AND d.id = $${params.push(id)}`;
  sql += " ORDER BY d.created_at DESC, d.id DESC";
  const draws = await query<Omit<OghamDraw, "staves">>(sql, params);
  if (draws.length === 0) return [];

  const rows = await query<{
    divination_id: number; stave_id: string; stave_name: string;
    position_name: string | null; position_prompt: string | null;
  }>(
    `SELECT o.divination_id, o.stave_id, o.stave_name, o.position_name,
            (SELECT lp.prompt FROM layout_positions lp
             WHERE lp.layout_id = dv.layout_id AND lp.name = o.position_name LIMIT 1) AS position_prompt
     FROM ogham_draws o JOIN divinations dv ON dv.id = o.divination_id
     WHERE o.user_id = $1 AND o.divination_id = ANY($2)
     ORDER BY o.sort_order ASC, o.id ASC`,
    [userId, draws.map((d) => d.id)]
  );
  return draws.map((d) => ({
    ...d,
    staves: rows
      .filter((r) => r.divination_id === d.id)
      .map((r) => ({
        stave_id: r.stave_id,
        stave_name: r.stave_name,
        position_name: r.position_name,
        position_prompt: r.position_prompt,
      })),
  }));
}

/** The person's draws, newest first. */
export function listDraws(userId: number): Promise<OghamDraw[]> {
  return findDraws(userId);
}

/** One draw, or null when it is not theirs. */
export async function loadDraw(userId: number, id: number): Promise<OghamDraw | null> {
  if (!id) return null;
  return (await findDraws(userId, id))[0] ?? null;
}

/** The one-line summary kept on the shared record: the stave names in order. */
export function drawSummary(staves: { stave_name: string }[]): string {
  return staves.map((s) => s.stave_name).join(", ");
}
