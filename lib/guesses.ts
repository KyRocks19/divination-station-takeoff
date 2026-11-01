import { query, queryOne } from "./db";
import type { DivinationKind } from "./divination-kinds";
import { countGuesses, type Confidence, type Fit, type Guess, type GuessCounts } from "./guess-core";

// "Write what you sense first" (migration 090): server side. Every function is scoped to the signed-in person.

/** The guess columns: 092 added how sure the person felt and the companion tick, 096 what the logical mind said. */
const COLUMNS = "divination_id, guess, skipped, sealed_at, fit, fit_note, fit_at, confidence, companion_ok, logic";

/** The guess on one of the person's readings, or null. */
export async function getGuess(userId: number, divinationId: number): Promise<Guess | null> {
  return queryOne<Guess>(`SELECT ${COLUMNS} FROM reading_guesses WHERE divination_id = $1 AND user_id = $2`, [divinationId, userId]);
}

/**
 * Seals a guess (or the setting aside of the step) on a reading of the person's own. The first one stands: a second call changes nothing and
 * returns what is there, so the words cannot be rewritten after the reading has been looked at. Null when the reading is not theirs.
 */
export async function sealGuess(
  userId: number, divinationId: number, text: string | null, confidence: Confidence | null = null, logic: string | null = null
): Promise<Guess | null> {
  const owned = await queryOne("SELECT 1 FROM divinations WHERE id = $1 AND user_id = $2", [divinationId, userId]);
  if (!owned) return null;
  // How sure the person felt and what the logical mind said belong to a written guess only, never to a step set aside.
  await query(
    `INSERT INTO reading_guesses (divination_id, user_id, guess, skipped, confidence, logic)
     VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (divination_id) DO NOTHING`,
    [divinationId, userId, text ?? "", text === null, text === null ? null : confidence, text === null ? null : logic]
  );
  return getGuess(userId, divinationId);
}

/**
 * Whether the companion may read this one guess (owner decision 2026-10-22: never by default, only by a tick on that reading). Null when there
 * is no written guess of the person's on that reading.
 */
export async function setCompanionOk(userId: number, divinationId: number, ok: boolean): Promise<Guess | null> {
  return queryOne<Guess>(
    `UPDATE reading_guesses SET companion_ok = $3 WHERE divination_id = $1 AND user_id = $2 AND NOT skipped RETURNING ${COLUMNS}`,
    [divinationId, userId, ok]
  );
}

/** Records how well a guess fitted (null takes the answer back). Null when there is no written guess of the person's on that reading. */
export async function setFit(userId: number, divinationId: number, fit: Fit | null, note: string | null): Promise<Guess | null> {
  return queryOne<Guess>(
    `UPDATE reading_guesses SET fit = $3, fit_note = $4, fit_at = CASE WHEN $3::smallint IS NULL THEN NULL ELSE NOW() END
     WHERE divination_id = $1 AND user_id = $2 AND NOT skipped RETURNING ${COLUMNS}`,
    [divinationId, userId, fit, fit === null ? null : note]
  );
}

/** Forgets the guess on a reading, so the step is open again. False when there was none. */
export async function deleteGuess(userId: number, divinationId: number): Promise<boolean> {
  return (await query("DELETE FROM reading_guesses WHERE divination_id = $1 AND user_id = $2 RETURNING divination_id", [divinationId, userId])).length > 0;
}

export interface ListedGuess extends Guess {
  kind: DivinationKind;
  reading_label: string;
  reading_id: number | null;
}

/** Every written guess the person has, newest first, with the reading it belongs to. */
export async function listWrittenGuesses(userId: number): Promise<ListedGuess[]> {
  return query<ListedGuess>(
    `SELECT ${COLUMNS.split(", ").map((c) => `g.${c}`).join(", ")}, d.kind,
            COALESCE(NULLIF(d.title, ''), NULLIF(d.summary, ''), 'Reading') AS reading_label, d.reading_id
     FROM reading_guesses g JOIN divinations d ON d.id = g.divination_id
     WHERE g.user_id = $1 AND NOT g.skipped ORDER BY g.sealed_at DESC, g.divination_id DESC`,
    [userId]
  );
}

export function countByKind(rows: { kind: DivinationKind; fit: Fit | null }[]): Map<DivinationKind, GuessCounts> {
  return countGuesses(rows.map((r) => ({ key: r.kind, fit: r.fit })));
}

/** Whether the step is switched on for the person (on by default). */
export async function guessStepOn(userId: number): Promise<boolean> {
  const row = await queryOne<{ guess_first: number }>("SELECT guess_first FROM users WHERE id = $1", [userId]);
  return row ? row.guess_first !== 0 : true;
}
