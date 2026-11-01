import { query } from "./db";
import { IDEOGRAM_FORM, OPTION_COUNT, practiceNumbers, type TrialState } from "./remoteview-core";
import { cleanDrawing, type Drawing } from "./oracle-art";
import { recordFact } from "./remoteview-share";

export * from "./remoteview-core";

// Blind-target practice, the database side (migration 085). A trial is one shared record (`divinations`, kind 'remoteview') plus one row in
// `remoteview_trials`. WHAT MAY BE READ WHEN is the rule of this file: the four options are returned only once the impression is sealed, and the target
// only once the person has chosen. Nothing here ever returns more, so no page, route, export or summary built on it can show a target early. Every query is
// for one person.

export interface Trial {
  /** The id of the shared record in `divinations`. */
  id: number;
  question: string | null;
  sky: string | null;
  created_at: string;
  state: TrialState;
  /** The sealed impression, once there is one. */
  impression: string | null;
  /** The quick drawing sealed with the impression, if the person made one. */
  ideogram: Drawing | null;
  sealed_at: string | null;
  /** The four options: null until the impression is sealed. */
  options: string[] | null;
  choice_index: number | null;
  /** Which option was the target: null until the person has chosen. */
  target_index: number | null;
  judged_at: string | null;
  entry_count: number;
}

interface Row {
  id: number;
  question: string | null;
  sky: string | null;
  created_at: string;
  impression: string | null;
  ideogram: unknown;
  sealed_at: string | null;
  options: string[];
  choice_index: number | null;
  target_index: number;
  judged_at: string | null;
  entry_count: number;
}

function toTrial(r: Row): Trial {
  const state: TrialState = r.judged_at ? "judged" : r.sealed_at ? "sealed" : "open";
  return {
    id: r.id,
    question: r.question,
    sky: r.sky,
    created_at: r.created_at,
    state,
    impression: state === "open" ? null : r.impression,
    ideogram: state === "open" || !r.ideogram ? null : (() => { const c = cleanDrawing(r.ideogram, IDEOGRAM_FORM); return c.ok ? c.drawing : null; })(),
    sealed_at: r.sealed_at,
    options: state === "open" ? null : r.options,
    choice_index: state === "judged" ? r.choice_index : null,
    target_index: state === "judged" ? r.target_index : null,
    judged_at: r.judged_at,
    entry_count: r.entry_count,
  };
}

async function findTrials(userId: number, id?: number): Promise<Trial[]> {
  const params: number[] = [userId];
  let sql = `
    SELECT d.id, d.question, d.sky, d.created_at, t.impression, t.ideogram, t.sealed_at, t.options, t.choice_index, t.target_index, t.judged_at,
           (SELECT COUNT(*)::int FROM journals j WHERE j.divination_id = d.id) AS entry_count
    FROM divinations d JOIN remoteview_trials t ON t.divination_id = d.id
    WHERE d.user_id = $1 AND t.user_id = $1 AND d.kind = 'remoteview'`;
  if (id) sql += ` AND d.id = $${params.push(id)}`;
  sql += " ORDER BY d.created_at DESC, d.id DESC";
  return (await query<Row>(sql, params)).map(toTrial);
}

export function listTrials(userId: number): Promise<Trial[]> {
  return findTrials(userId);
}

export async function loadTrial(userId: number, id: number): Promise<Trial | null> {
  if (!id) return null;
  return (await findTrials(userId, id))[0] ?? null;
}

/** The person's own results over all judged trials. */
export function numbersOf(trials: Trial[]) {
  const judged = trials.filter((t) => t.state === "judged");
  return practiceNumbers(judged.length, judged.filter((t) => t.choice_index === t.target_index).length);
}

/** Seals the impression, once. False when the trial is not the person's or its impression was already sealed. */
export async function sealImpression(userId: number, id: number, impression: string, ideogram: Drawing | null = null): Promise<boolean> {
  const rows = await query(
    "UPDATE remoteview_trials SET impression = $3, ideogram = $4::jsonb, sealed_at = NOW() WHERE divination_id = $1 AND user_id = $2 AND sealed_at IS NULL RETURNING id",
    [id, userId, impression, ideogram && ideogram.strokes.length > 0 ? JSON.stringify(ideogram) : null]
  );
  return rows.length > 0;
}

/** Records the choice, once, and sets the reading's one-line summary to the result in words (never the target). False when not allowed. */
export async function judgeTrial(userId: number, id: number, choice: number): Promise<boolean> {
  const rows = await query<{ target_index: number }>(
    "UPDATE remoteview_trials SET choice_index = $3, judged_at = NOW() WHERE divination_id = $1 AND user_id = $2 AND sealed_at IS NOT NULL AND judged_at IS NULL RETURNING target_index",
    [id, userId, choice]
  );
  if (rows.length === 0) return false;
  await recordFact(userId, "blind4", OPTION_COUNT, rows[0].target_index === choice);
  await query("UPDATE divinations SET summary = $1 WHERE id = $2 AND user_id = $3", [rows[0].target_index === choice ? "Blind-target trial: chose the target" : "Blind-target trial: chose another", id, userId]);
  return true;
}
