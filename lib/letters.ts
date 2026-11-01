import { query, queryOne } from "./db";
import { membership } from "./circles";
import { DIVINATION_KIND_LABELS, type DivinationKind } from "./divination-kinds";
import {
  MAX_WAITING_QUESTIONS,
  READING_CHOICE_DAYS,
  letterFor,
  readingLine,
  type LetterRow,
  type LetterView,
} from "./letters-core";

export * from "./letters-core";

// Letters, the database side (migration 103). Every function takes the signed-in person's id, and every UPDATE names the person's place in
// the letter in its WHERE, so a route cannot act on a letter that is not theirs. Server code only; the browser uses lib/letters-core.ts.

const NAME = (alias: string) => `COALESCE(NULLIF(${alias}.display_name, ''), ${alias}.username)`;

const SELECT = `
  SELECT l.id, l.circle_id, l.asker_id, ${NAME("a")} AS asker_name, l.to_user_id, ${NAME("t")} AS to_name, (l.to_circle = 1) AS to_circle,
         l.question, (l.blind = 1) AS blind, l.created_at, l.declined_at, l.reader_id, ${NAME("r")} AS reader_name, l.taken_at,
         l.divination_id, d.kind AS divination_kind, d.reading_id AS divination_reading_id, l.reading_line, l.letter, l.sealed_at, l.opened_at, to_char(l.write_back_on, 'YYYY-MM-DD') AS write_back_on,
         l.reply, l.replied_at, l.reply_seen_at, l.reader_hidden_at
  FROM letters l
  JOIN users a ON a.id = l.asker_id
  LEFT JOIN users t ON t.id = l.to_user_id
  LEFT JOIN users r ON r.id = l.reader_id
  LEFT JOIN divinations d ON d.id = l.divination_id AND d.user_id = l.reader_id`;

/**
 * A letter is waiting for this person to pick up when no one has it yet, the member it was asked of has not passed on it, it was asked of
 * them or of the whole circle, and both they and the asker are in the circle it was asked in. Uses $1 for the person's id.
 */
const OFFERED = `(
  l.reader_id IS NULL AND l.declined_at IS NULL AND l.asker_id <> $1 AND l.circle_id IS NOT NULL
  AND (l.to_user_id = $1 OR l.to_circle = 1)
  AND EXISTS (SELECT 1 FROM circle_members m WHERE m.circle_id = l.circle_id AND m.user_id = $1)
  AND EXISTS (SELECT 1 FROM circle_members m WHERE m.circle_id = l.circle_id AND m.user_id = l.asker_id)
)`;

/** Every letter this person may see: the ones they asked, the ones they read for, and the ones waiting for them. Newest first. */
export async function listLetters(userId: number): Promise<LetterView[]> {
  const rows = await query<LetterRow & { offered: boolean }>(
    `${SELECT.replace("SELECT l.id", `SELECT ${OFFERED} AS offered, l.id`)}
     WHERE l.asker_id = $1 OR l.reader_id = $1 OR ${OFFERED}
     ORDER BY COALESCE(l.replied_at, l.sealed_at, l.taken_at, l.created_at) DESC, l.id DESC
     LIMIT 300`,
    [userId]
  );
  return rows.flatMap((r) => letterFor(r, userId, r.offered) ?? []);
}

/** The letters this person sent about one of their own readings, so the reading's page can show the replies beside its look-backs. */
export async function lettersForReading(userId: number, divinationId: number): Promise<LetterView[]> {
  const rows = await query<LetterRow>(`${SELECT} WHERE l.reader_id = $1 AND l.divination_id = $2 AND l.sealed_at IS NOT NULL ORDER BY l.sealed_at, l.id`, [
    userId,
    divinationId,
  ]);
  return rows.flatMap((r) => letterFor(r, userId) ?? []);
}

/** The other members of this person's circle, by name, for "who to ask". Empty when they are in no circle. */
export async function askableMembers(userId: number): Promise<{ id: number; name: string }[]> {
  return query<{ id: number; name: string }>(
    `SELECT u.id, ${NAME("u")} AS name FROM circle_members m JOIN circle_members me ON me.circle_id = m.circle_id AND me.user_id = $1
     JOIN users u ON u.id = m.user_id WHERE m.user_id <> $1 ORDER BY name, u.id`,
    [userId]
  );
}

/** The person's own readings from the last two weeks, newest first, to choose one to go with a letter. */
export async function readingChoices(userId: number): Promise<{ id: number; line: string; created_at: string }[]> {
  const rows = await query<{ id: number; kind: DivinationKind; summary: string | null; title: string | null; question: string | null; created_at: string }>(
    `SELECT d.id, d.kind, d.summary, COALESCE(NULLIF(r.title, ''), d.title) AS title, d.question, d.created_at
     FROM divinations d LEFT JOIN readings r ON r.id = d.reading_id
     WHERE d.user_id = $1 AND d.created_at > NOW() - make_interval(days => $2)
     ORDER BY d.created_at DESC, d.id DESC LIMIT 30`,
    [userId, READING_CHOICE_DAYS]
  );
  return rows.map((r) => ({ id: r.id, line: readingLine(DIVINATION_KIND_LABELS[r.kind] ?? "Reading", r.summary, r.title), created_at: r.created_at }));
}

export type AskProblem = "no_circle" | "not_in_circle" | "too_many";

/** Asks a question of one member of the person's circle, or of the whole circle. */
export async function askLetter(
  userId: number,
  question: string,
  to: { to: "circle" } | { to: "member"; id: number },
  blind: boolean
): Promise<{ ok: true; id: number } | { ok: false; problem: AskProblem }> {
  const m = await membership(userId);
  if (!m) return { ok: false, problem: "no_circle" };
  if (to.to === "member") {
    if (to.id === userId) return { ok: false, problem: "not_in_circle" };
    const there = await queryOne("SELECT 1 FROM circle_members WHERE circle_id = $1 AND user_id = $2", [m.circle_id, to.id]);
    if (!there) return { ok: false, problem: "not_in_circle" };
  }
  const waiting = await queryOne<{ n: number }>("SELECT COUNT(*)::int AS n FROM letters WHERE asker_id = $1 AND sealed_at IS NULL", [userId]);
  if ((waiting?.n ?? 0) >= MAX_WAITING_QUESTIONS) return { ok: false, problem: "too_many" };
  const row = await queryOne<{ id: number }>(
    `INSERT INTO letters (circle_id, asker_id, to_user_id, to_circle, question, blind) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [m.circle_id, userId, to.to === "member" ? to.id : null, to.to === "circle" ? 1 : 0, question, blind ? 1 : 0]
  );
  return { ok: true, id: row!.id };
}

/** One UPDATE that changes the letter only when the WHERE says the person may; true when it did. */
async function change(sql: string, params: unknown[]): Promise<boolean> {
  return (await query(`${sql} RETURNING l.id`, params)).length > 0;
}

/** The reader picks up a letter that is waiting for them. */
export const takeLetter = (userId: number, id: number) =>
  change(`UPDATE letters l SET reader_id = $1, taken_at = NOW() WHERE l.id = $2 AND ${OFFERED}`, [userId, id]);

/** The reader puts a letter back before sealing it, so someone else may read for it (or, when it was asked of them, so it waits again). */
export const putBackLetter = (userId: number, id: number) =>
  change(`UPDATE letters l SET reader_id = NULL, taken_at = NULL, divination_id = NULL WHERE l.id = $2 AND l.reader_id = $1 AND l.sealed_at IS NULL`, [userId, id]);

/** The member a letter was asked of would rather not read for it. The asker is told and may ask the whole circle instead. */
export const declineLetter = (userId: number, id: number) =>
  change(`UPDATE letters l SET declined_at = NOW() WHERE l.id = $2 AND l.to_user_id = $1 AND l.to_circle = 0 AND l.reader_id IS NULL AND l.declined_at IS NULL`, [userId, id]);

/** The asker opens a waiting or passed-on question to anyone in their circle. */
export const askCircleInstead = (userId: number, id: number) =>
  change(
    `UPDATE letters l SET to_circle = 1, to_user_id = NULL, declined_at = NULL
     WHERE l.id = $2 AND l.asker_id = $1 AND l.reader_id IS NULL
       AND EXISTS (SELECT 1 FROM circle_members m WHERE m.circle_id = l.circle_id AND m.user_id = $1)`,
    [userId, id]
  );

export type SealProblem = "not_found" | "reading_not_found";

/** The reader seals their letter, with one of their own recent readings or none. After this the letter cannot be changed. */
export async function sealLetter(userId: number, id: number, letter: string, divinationId: number | null): Promise<{ ok: true } | { ok: false; problem: SealProblem }> {
  let line: string | null = null;
  if (divinationId !== null) {
    const choice = (await readingChoices(userId)).find((c) => c.id === divinationId);
    if (!choice) return { ok: false, problem: "reading_not_found" };
    line = choice.line;
  }
  const ok = await change(
    `UPDATE letters l SET letter = $3, divination_id = $4, reading_line = $5, sealed_at = NOW()
     WHERE l.id = $2 AND l.reader_id = $1 AND l.sealed_at IS NULL`,
    [userId, id, letter, divinationId, line]
  );
  return ok ? { ok: true } : { ok: false, problem: "not_found" };
}

/** The asker opens a letter that has arrived. */
export const openLetter = (userId: number, id: number) =>
  change(`UPDATE letters l SET opened_at = NOW() WHERE l.id = $2 AND l.asker_id = $1 AND l.sealed_at IS NOT NULL AND l.opened_at IS NULL`, [userId, id]);

/** The asker sets or clears the day they would like a reminder to write back. */
export const setWriteBackOn = (userId: number, id: number, day: string | null) =>
  change(`UPDATE letters l SET write_back_on = $3 WHERE l.id = $2 AND l.asker_id = $1 AND l.sealed_at IS NOT NULL`, [userId, id, day]);

/** The asker writes back how it went (or rewords what they wrote). The reader is shown it as new. */
export const replyToLetter = (userId: number, id: number, reply: string) =>
  change(
    `UPDATE letters l SET reply = $3, replied_at = NOW(), reply_seen_at = NULL, write_back_on = NULL
     WHERE l.id = $2 AND l.asker_id = $1 AND l.opened_at IS NOT NULL`,
    [userId, id, reply]
  );

/** The reader has seen the reply. */
export const markReplySeen = (userId: number, id: number) =>
  change(`UPDATE letters l SET reply_seen_at = NOW() WHERE l.id = $2 AND l.reader_id = $1 AND l.replied_at IS NOT NULL`, [userId, id]);

/**
 * Deleting, from either side. The asker deletes the whole letter: their question, the letter they were sent and their reply, for both of
 * them. A reader who has not sealed yet puts it back. A reader who has sealed takes it off their own list; the asker keeps the letter.
 */
export async function deleteLetter(userId: number, id: number): Promise<boolean> {
  if ((await query("DELETE FROM letters WHERE id = $1 AND asker_id = $2 RETURNING id", [id, userId])).length > 0) return true;
  if (await putBackLetter(userId, id)) return true;
  return change(`UPDATE letters l SET reader_hidden_at = NOW() WHERE l.id = $2 AND l.reader_id = $1 AND l.sealed_at IS NOT NULL`, [userId, id]);
}

/**
 * Before an account is deleted: letters it picked up and did not seal go back to waiting, so the asker's question is not lost. Sealed letters
 * it wrote go with the account (reader_id cascades), and so does everything it asked.
 */
export async function releaseLettersBeforeDelete(userId: number): Promise<void> {
  await query("UPDATE letters SET reader_id = NULL, taken_at = NULL, divination_id = NULL WHERE reader_id = $1 AND sealed_at IS NULL", [userId]);
}

/** The rows for the data export: what this person asked, and the letters they sealed. lib/letters-core.ts keeps only their own words. */
export async function letterRowsForExport(userId: number): Promise<LetterRow[]> {
  return await query<LetterRow>(`${SELECT} WHERE l.asker_id = $1 OR (l.reader_id = $1 AND l.sealed_at IS NOT NULL) ORDER BY l.created_at, l.id`, [userId]);
}
