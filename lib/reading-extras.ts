import { query, queryOne } from "./db";
import { DIVINATION_KIND_LABELS, divinationPath, type DivinationKind } from "./divination-kinds";
import { questionKey, type QuestionGroup, type SameQuestionReading } from "./reading-extras-core";

// Two intuition pieces under every reading (owner decision 2026-10-22, release plan §6 ideas 2 and 5), server side and scoped to the person:
// - a look-back reminder: the day they asked to be reminded to look back on this reading (divinations.look_back_on, migration 092);
// - the same question asked with other tools: readings whose question is the same words (case and spacing ignored), with what the person sensed
//   first on each, side by side. Only the person's own words; the app never compares or judges them.

/** The reminder day on one of the person's readings, YYYY-MM-DD or null. */
export async function getLookBack(userId: number, divinationId: number): Promise<{ found: boolean; on: string | null }> {
  const row = await queryOne<{ day: string | null }>(
    "SELECT to_char(look_back_on, 'YYYY-MM-DD') AS day FROM divinations WHERE id = $1 AND user_id = $2",
    [divinationId, userId]
  );
  return { found: !!row, on: row?.day ?? null };
}

/** Sets or clears the reminder day. False when the reading is not the person's. */
export async function setLookBack(userId: number, divinationId: number, on: string | null): Promise<boolean> {
  const rows = await query("UPDATE divinations SET look_back_on = $3 WHERE id = $1 AND user_id = $2 RETURNING id", [divinationId, userId, on]);
  return rows.length > 0;
}

interface Row {
  id: number;
  kind: DivinationKind;
  reading_id: number | null;
  question: string;
  created_at: string | Date;
  guess: string | null;
  fit: number | null;
}

/** Each reading, with its guess when there is one. */
async function readingsWithGuesses(userId: number, where: string, params: unknown[]): Promise<Row[]> {
  return query<Row>(
    `SELECT d.id, d.kind, d.reading_id, d.question, d.created_at, NULLIF(g.guess, '') AS guess, g.fit
     FROM divinations d LEFT JOIN reading_guesses g ON g.divination_id = d.id AND g.user_id = d.user_id
     WHERE d.user_id = $1 AND ${where} ORDER BY d.created_at DESC, d.id DESC LIMIT 200`,
    [userId, ...params]
  );
}

const toReading = (r: Row): SameQuestionReading => ({
  id: r.id,
  kind: r.kind,
  tool: DIVINATION_KIND_LABELS[r.kind] ?? "Reading",
  href: divinationPath(r.kind, r.id, r.reading_id),
  when: new Date(r.created_at).toISOString(),
  guess: r.guess,
  fit: r.fit,
});

const KEY_SQL = "lower(regexp_replace(trim(d.question), '\\s+', ' ', 'g'))";

/** The person's other readings that asked the same question as this one, newest first. Empty when this one has no question. */
export async function sameQuestion(userId: number, divinationId: number): Promise<SameQuestionReading[]> {
  const head = await queryOne<{ question: string | null }>("SELECT question FROM divinations WHERE id = $1 AND user_id = $2", [divinationId, userId]);
  const key = questionKey(head?.question);
  if (!key) return [];
  const rows = await readingsWithGuesses(userId, `${KEY_SQL} = $2 AND d.id <> $3`, [key, divinationId]);
  return rows.map(toReading);
}

/** Every question the person asked in two or more readings, newest first, with each reading and what they sensed first. */
export async function questionGroups(userId: number): Promise<QuestionGroup[]> {
  const rows = await readingsWithGuesses(
    userId,
    `d.question IS NOT NULL AND trim(d.question) <> '' AND ${KEY_SQL} IN (
       SELECT ${KEY_SQL} FROM divinations d WHERE d.user_id = $1 AND d.question IS NOT NULL AND trim(d.question) <> ''
       GROUP BY 1 HAVING COUNT(*) > 1)`,
    []
  );
  const groups = new Map<string, QuestionGroup>();
  for (const r of rows) {
    const key = questionKey(r.question)!;
    const g = groups.get(key) ?? { question: r.question.trim(), readings: [] };
    g.readings.push(toReading(r));
    groups.set(key, g);
  }
  return [...groups.values()];
}
