import { query, queryOne } from "./db";
import { BUILTIN_SWINGS, type SwingShape } from "./pendulum-swings";

export {
  BUILTIN_SWINGS,
  LAST_ANGLE,
  LAST_ANGLE_EXACT,
  MAX_SWING_NAME_LENGTH,
  MAX_SWINGS,
  cleanAngle,
  formatAngle,
  lineSymbolId,
  splitAngle,
  swingName,
  swingWords,
  wordingChange,
  type SwingShape,
} from "./pendulum-swings";

// Pendulum: a person asks a question and watches a swing. The app picks the swing by chance, from the swings the
// person has in play, with their own random method (Settings). What each swing means is the person's own words,
// kept in `pendulum_swings` with every earlier wording in `pendulum_swing_revisions` (migration 026). An answer is
// one shared record (`divinations`, kind 'pendulum') plus a row in `pendulum_answers`, which keeps the swing and the
// person's wording as they were then. What the person makes of an answer is kept in `journals`, as for any reading.

/** An earlier wording of what a swing means: the text it had, and when it was written. */
export interface SwingWording {
  id: number;
  content: string;
  created_at: string;
}

/** One of a person's swings. */
export interface PendulumSwing {
  id: number;
  shape: SwingShape;
  /** Degrees clockwise from straight up and down, to a tenth. Only a line has one. */
  angle: number | null;
  /** A name the person gave an added swing. */
  name: string | null;
  /** 1 for the five swings everyone starts with. Those can be left out of play but not deleted. */
  builtin: number;
  /** The person's own words for what the swing means to them. */
  meaning: string | null;
  /** 1 when the swing can come up. */
  in_play: number;
  sort_order: number;
  created_at: string;
  /** When the current wording was written. */
  updated_at: string;
  earlier: SwingWording[];
}

/** Makes the person's five starting swings if they do not have them yet. Safe to call again and again. */
export async function ensureSwings(userId: number): Promise<void> {
  const row = await queryOne<{ c: number }>(
    "SELECT COUNT(*)::int AS c FROM pendulum_swings WHERE user_id = $1 AND builtin = 1",
    [userId]
  );
  if ((row?.c ?? 0) >= BUILTIN_SWINGS.length) return;
  for (const [i, swing] of BUILTIN_SWINGS.entries()) {
    await query(
      `INSERT INTO pendulum_swings (user_id, shape, angle, builtin, sort_order)
       VALUES ($1, $2, $3, 1, $4)
       ON CONFLICT DO NOTHING`,
      [userId, swing.shape, swing.angle, i]
    );
  }
}

/**
 * A line's angle as one number: the whole degrees and the tenth (migration 064) kept in two columns, put together.
 * Everything else that reads whole degrees straight from the table is unaffected.
 */
export const SWING_ANGLE_SQL = "CASE WHEN angle IS NULL THEN NULL ELSE (angle + angle_tenths / 10.0)::float8 END";

const SWING_COLUMNS = `id, shape, ${SWING_ANGLE_SQL} AS angle, name, builtin, meaning, in_play, sort_order, created_at, updated_at`;

/** The starting swings first, then the added lines by angle (several at one angle in the order they were made). */
export const SWING_ORDER = "ORDER BY builtin DESC, sort_order ASC, angle ASC NULLS LAST, angle_tenths ASC, id ASC";

async function withWordings(userId: number, swings: Omit<PendulumSwing, "earlier">[]): Promise<PendulumSwing[]> {
  if (swings.length === 0) return [];
  const earlier = await query<SwingWording & { swing_id: number }>(
    `SELECT id, swing_id, content, created_at
     FROM pendulum_swing_revisions
     WHERE user_id = $1
     ORDER BY created_at DESC, id DESC`,
    [userId]
  );
  return swings.map((s) => ({
    ...s,
    earlier: earlier.filter((w) => w.swing_id === s.id).map(({ id, content, created_at }) => ({ id, content, created_at })),
  }));
}

/** All of the person's swings, each with its earlier wordings. Makes the starting five first if needed. */
export async function listSwings(userId: number): Promise<PendulumSwing[]> {
  await ensureSwings(userId);
  const swings = await query<Omit<PendulumSwing, "earlier">>(
    `SELECT ${SWING_COLUMNS} FROM pendulum_swings WHERE user_id = $1 ${SWING_ORDER}`,
    [userId]
  );
  return withWordings(userId, swings);
}

/** One swing, or null when it is not theirs. */
export async function loadSwing(userId: number, id: number): Promise<PendulumSwing | null> {
  if (!id) return null;
  const swing = await queryOne<Omit<PendulumSwing, "earlier">>(
    `SELECT ${SWING_COLUMNS} FROM pendulum_swings WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return swing ? (await withWordings(userId, [swing]))[0] : null;
}

/** One answer the pendulum gave. `id` is the id of its shared record in `divinations`. */
export interface PendulumAnswer {
  id: number;
  question: string | null;
  /** JSON snapshot of the sky when the answer was given. */
  sky: string | null;
  created_at: string;
  /** null when the swing has since been deleted. */
  swing_id: number | null;
  shape: SwingShape;
  angle: number | null;
  /** What the swing was called at the time. */
  swing_name: string;
  /** The person's own words for the swing at the time. */
  meaning: string | null;
  /** 'chance' when the app picked the swing, 'motion' when it was matched to the person's own phone movement. */
  chosen_by: "chance" | "motion";
  /** For 'motion': the shape of the movement, and for a line its angle in whole degrees. Never the sensor readings. */
  motion_shape: SwingShape | null;
  motion_angle: number | null;
  /** How many entries the person has written about this answer. */
  entry_count: number;
}

async function findAnswers(userId: number, id?: number): Promise<PendulumAnswer[]> {
  const params: number[] = [userId];
  let sql = `
    SELECT d.id, d.question, d.sky, d.created_at,
           a.swing_id, a.shape,
           CASE WHEN a.angle IS NULL THEN NULL ELSE (a.angle + a.angle_tenths / 10.0)::float8 END AS angle,
           a.swing_name, a.meaning, a.chosen_by, a.motion_shape, a.motion_angle,
           (SELECT COUNT(*)::int FROM journals j WHERE j.divination_id = d.id) AS entry_count
    FROM divinations d JOIN pendulum_answers a ON a.divination_id = d.id
    WHERE d.user_id = $1 AND d.kind = 'pendulum'`;
  if (id) sql += ` AND d.id = $${params.push(id)}`;
  sql += " ORDER BY d.created_at DESC, d.id DESC";
  return query<PendulumAnswer>(sql, params);
}

/** The person's answers, newest first. */
export function listAnswers(userId: number): Promise<PendulumAnswer[]> {
  return findAnswers(userId);
}

/** One answer, or null when it is not theirs. */
export async function loadAnswer(userId: number, id: number): Promise<PendulumAnswer | null> {
  if (!id) return null;
  return (await findAnswers(userId, id))[0] ?? null;
}
