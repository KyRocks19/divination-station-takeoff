import { query, queryOne } from "./db";
import type { DivinationKind } from "./divination-kinds";

// Prediction check-ins (migration 044): what a person expects after a reading of any tool, written down at the time and looked back on
// later. The person alone decides whether it came true; the app never judges, grades, or adds a prediction of its own.

export { OUTCOMES, OUTCOME_LABELS, type Outcome } from "./prediction-words";
import { type Outcome } from "./prediction-words";

export const MAX_PREDICTION_LENGTH = 2000;
/** The most predictions kept open (no outcome yet) per person, so one account cannot fill the database. */
export const MAX_OPEN_PREDICTIONS = 200;
/** How many answered predictions a tool needs before a percentage is shown next to its counts. */
export const MIN_FOR_PERCENT = 10;

export type { Prediction } from "./prediction-words";
import type { Prediction } from "./prediction-words";

const COLUMNS = `p.id, p.divination_id, p.original_text, p.text, p.created_at, to_char(p.check_on, 'YYYY-MM-DD') AS check_on,
                 p.outcome, p.outcome_note, p.resolved_at`;

/** A date typed as YYYY-MM-DD, or null when empty. `undefined` means it is not valid. */
export function cleanCheckOn(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const d = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== value) return undefined;
  if (d.getUTCFullYear() < 2000 || d.getUTCFullYear() > 2200) return undefined;
  return value;
}

export function cleanPredictionText(value: unknown): { ok: true; text: string } | { ok: false; error: string } {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return { ok: false, error: "Write what you expect to happen." };
  if (text.length > MAX_PREDICTION_LENGTH) return { ok: false, error: `That is too long (${MAX_PREDICTION_LENGTH} characters at most).` };
  return { ok: true, text };
}

export interface Tally {
  yes: number;
  partly: number;
  no: number;
  unclear: number;
  open: number;
}

export const emptyTally = (): Tally => ({ yes: 0, partly: 0, no: 0, unclear: 0, open: 0 });

/** Predictions with an answer that counts: "can't tell" is left out. */
export function answered(t: Tally): number {
  return t.yes + t.partly + t.no;
}

/** Percentages only once there are enough answers to mean something; before that, only counts. */
export function percentages(t: Tally): { yes: number; partly: number; no: number } | null {
  const n = answered(t);
  if (n < MIN_FOR_PERCENT) return null;
  return { yes: Math.round((t.yes / n) * 100), partly: Math.round((t.partly / n) * 100), no: Math.round((t.no / n) * 100) };
}

/** The predictions on one reading, oldest first. Empty when the reading is not the person's. */
export async function listForDivination(userId: number, divinationId: number): Promise<Prediction[]> {
  return query<Prediction>(
    `SELECT ${COLUMNS} FROM predictions p WHERE p.divination_id = $1 AND p.user_id = $2 ORDER BY p.created_at, p.id`,
    [divinationId, userId]
  );
}

/** The shared reading record for a tarot reading (`reading_id`), or null when it is not the person's. */
export async function divinationForReading(userId: number, readingId: number): Promise<number | null> {
  const row = await queryOne<{ id: number }>("SELECT id FROM divinations WHERE reading_id = $1 AND user_id = $2", [readingId, userId]);
  return row?.id ?? null;
}

export async function ownsDivination(userId: number, divinationId: number): Promise<boolean> {
  return !!(await queryOne("SELECT 1 FROM divinations WHERE id = $1 AND user_id = $2", [divinationId, userId]));
}

export async function countOpen(userId: number): Promise<number> {
  const row = await queryOne<{ n: string }>("SELECT COUNT(*) AS n FROM predictions WHERE user_id = $1 AND outcome IS NULL", [userId]);
  return Number(row?.n ?? 0);
}

export async function createPrediction(userId: number, divinationId: number, text: string, checkOn: string | null): Promise<Prediction> {
  const row = await queryOne<Prediction>(
    `INSERT INTO predictions (user_id, divination_id, original_text, text, check_on) VALUES ($1, $2, $3, $3, $4)
     RETURNING id, divination_id, original_text, text, created_at, to_char(check_on, 'YYYY-MM-DD') AS check_on, outcome, outcome_note, resolved_at`,
    [userId, divinationId, text, checkOn]
  );
  return row!;
}

export interface PredictionChange {
  text?: string;
  /** `null` clears the date. */
  checkOn?: string | null;
  /** `null` takes the outcome back, so the prediction is open again. */
  outcome?: Outcome | null;
  outcomeNote?: string | null;
}

/** Changes one prediction of the person's. The sealed original text is never touched, and the wording can only change while it is open. Null when it is not theirs (or is already answered, for a rewording). */
export async function updatePrediction(userId: number, id: number, change: PredictionChange): Promise<Prediction | null> {
  const sets: string[] = [];
  const values: unknown[] = [id, userId];
  const add = (sql: string, v: unknown) => {
    values.push(v);
    sets.push(sql.replace("?", `$${values.length}`));
  };
  if (change.text !== undefined) add("text = ?", change.text);
  if (change.checkOn !== undefined) add("check_on = ?", change.checkOn);
  if (change.outcome !== undefined) {
    add("outcome = ?", change.outcome);
    sets.push(change.outcome === null ? "resolved_at = NULL" : "resolved_at = NOW()");
    if (change.outcome === null && change.outcomeNote === undefined) sets.push("outcome_note = NULL");
  }
  if (change.outcomeNote !== undefined) add("outcome_note = ?", change.outcomeNote);
  if (sets.length === 0) return (await queryOne<Prediction>(`SELECT ${COLUMNS} FROM predictions p WHERE p.id = $1 AND p.user_id = $2`, [id, userId])) ?? null;
  return queryOne<Prediction>(
    `UPDATE predictions p SET ${sets.join(", ")} WHERE p.id = $1 AND p.user_id = $2${change.text !== undefined ? " AND p.outcome IS NULL" : ""}
     RETURNING p.id, p.divination_id, p.original_text, p.text, p.created_at, to_char(p.check_on, 'YYYY-MM-DD') AS check_on, p.outcome, p.outcome_note, p.resolved_at`,
    values
  );
}

export async function deletePrediction(userId: number, id: number): Promise<boolean> {
  return (await query("DELETE FROM predictions WHERE id = $1 AND user_id = $2 RETURNING id", [id, userId])).length > 0;
}

export interface ListedPrediction extends Prediction {
  kind: DivinationKind;
  reading_label: string;
  reading_id: number | null;
}

/** Every prediction the person has, newest first, with the reading it belongs to. */
export async function listAll(userId: number): Promise<ListedPrediction[]> {
  return query<ListedPrediction>(
    `SELECT ${COLUMNS}, d.kind, COALESCE(NULLIF(d.title, ''), NULLIF(d.summary, ''), 'Reading') AS reading_label, d.reading_id
     FROM predictions p JOIN divinations d ON d.id = p.divination_id
     WHERE p.user_id = $1 ORDER BY p.created_at DESC, p.id DESC`,
    [userId]
  );
}

/** Open predictions whose date has come, soonest first. */
export async function listDue(userId: number, limit = 5): Promise<ListedPrediction[]> {
  return query<ListedPrediction>(
    `SELECT ${COLUMNS}, d.kind, COALESCE(NULLIF(d.title, ''), NULLIF(d.summary, ''), 'Reading') AS reading_label, d.reading_id
     FROM predictions p JOIN divinations d ON d.id = p.divination_id
     WHERE p.user_id = $1 AND p.outcome IS NULL AND p.check_on IS NOT NULL AND p.check_on <= CURRENT_DATE
     ORDER BY p.check_on, p.id LIMIT $2`,
    [userId, limit]
  );
}

/** Counts per tool (the kind of reading each prediction was made about). */
export function tallyByKind(rows: { kind: DivinationKind; outcome: Outcome | null }[]): Map<DivinationKind, Tally> {
  const map = new Map<DivinationKind, Tally>();
  for (const r of rows) {
    const t = map.get(r.kind) ?? emptyTally();
    if (r.outcome) t[r.outcome] += 1;
    else t.open += 1;
    map.set(r.kind, t);
  }
  return map;
}
