import { query, queryOne } from "./db";
import { DIVINATION_KIND_LABELS, divinationPath, type DivinationKind } from "./divination-kinds";
import { MODE_TITLES, isCompanionMode } from "./companion-modes";
import { OUTCOME_LABELS, type Outcome } from "./prediction-words";
import { symbolName } from "./companion-pattern";
import {
  ADDABLE_NOW, MAX_DAY_BODY, MAX_ITEMS_PER_DAY, SNAPSHOT_ONLY, addDays, dayWindow, isValidDay, localDay, readingSnapshot, tallyReadingDays, tzOfSky,
  type ItemKind, type ItemMode, type ReadingDayTally, type SnapshotEntry,
} from "./days-core";

// The daily journal: a page for each day with the person's own writing and the things they chose to keep with it (slice "days", migration 057).
// Every query is for one person. Nothing here is shown to anyone else.

const toIso = (d: string | Date) => (d instanceof Date ? d.toISOString() : new Date(d).toISOString());

/** What an original looks like right now: its title, its words, and where it lives. Null when it is not there (or not the person's). */
export interface Resolved {
  title: string;
  text: string;
  href: string | null;
  /** The reading a kept answer came from (its shared record), when the original is not itself a reading. */
  sourceId?: number;
}

async function entriesOf(userId: number, divinationId: number): Promise<SnapshotEntry[]> {
  const rows = await query<{ kind: string | null; thinking_mind: number; content: string; created_at: string | Date }>(
    `SELECT j.kind, j.thinking_mind, j.content, j.created_at
       FROM journals j JOIN divinations d ON (d.id = j.divination_id OR (j.reading_id IS NOT NULL AND d.reading_id = j.reading_id))
      WHERE d.id = $1 AND d.user_id = $2 AND j.author = 'user' ORDER BY j.created_at, j.id`,
    [divinationId, userId]
  );
  return rows.map((r) => ({
    when: toIso(r.created_at).slice(0, 10),
    kind: r.kind === "impression" ? "impression" : r.kind === "lookback" ? "lookback" : "note",
    thinkingMind: r.thinking_mind === 1,
    content: r.content,
  }));
}

async function resolveReading(userId: number, id: number): Promise<Resolved | null> {
  const d = await queryOne<{ id: number; kind: DivinationKind; title: string | null; question: string | null; summary: string; layout_name: string | null; reading_id: number | null }>(
    "SELECT id, kind, title, question, summary, layout_name, reading_id FROM divinations WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  if (!d) return null;
  const label = DIVINATION_KIND_LABELS[d.kind] ?? d.kind;
  return {
    title: `${label}: ${(d.title?.trim() || d.summary.trim() || "reading").slice(0, 120)}`,
    text: readingSnapshot({ question: d.question, summary: d.summary, layoutName: d.layout_name, toolLabel: label, entries: await entriesOf(userId, d.id) }),
    href: divinationPath(d.kind, d.id, d.reading_id),
  };
}

async function resolveCompanionNote(userId: number, id: number): Promise<Resolved | null> {
  const n = await queryOne<{ mode: string; companion_name: string; content: string; divination_id: number; kind: DivinationKind; reading_id: number | null }>(
    `SELECT n.mode, n.companion_name, n.content, d.id AS divination_id, d.kind, d.reading_id
       FROM companion_notes n JOIN divinations d ON d.id = n.divination_id WHERE n.id = $1 AND n.user_id = $2`,
    [id, userId]
  );
  if (!n) return null;
  const title = n.mode === "changes" ? "What has changed (put together by the app, no AI)" : `${isCompanionMode(n.mode) ? MODE_TITLES[n.mode] : "Answer"}, written by ${n.companion_name}, an AI`;
  return { title, text: n.content, href: divinationPath(n.kind, n.divination_id, n.reading_id), sourceId: n.divination_id };
}

const AUTHOR_WORDS: Record<string, string> = {
  user: "Your entry",
  hiero: "Hiero, an AI",
  claude: "Hiero, an AI",
  guide: "Your Guide, an AI",
  sword: "an earlier AI entry",
  interview: "Hiero's interview, an AI",
};

/** One entry on one of the person's own readings, by them or by an AI (the label says which). */
async function resolveJournalEntry(userId: number, id: number): Promise<Resolved | null> {
  const j = await queryOne<{ author: string; kind: string | null; content: string; created_at: string | Date; divination_id: number; dkind: DivinationKind; reading_id: number | null }>(
    `SELECT j.author, j.kind, j.content, j.created_at, d.id AS divination_id, d.kind AS dkind, d.reading_id
       FROM journals j JOIN divinations d ON (d.id = j.divination_id OR (j.reading_id IS NOT NULL AND d.reading_id = j.reading_id))
      WHERE j.id = $1 AND d.user_id = $2`,
    [id, userId]
  );
  if (!j) return null;
  const how = j.kind === "impression" ? ", what you noticed first" : j.kind === "lookback" ? ", looking back" : "";
  const label = DIVINATION_KIND_LABELS[j.dkind] ?? j.dkind;
  return {
    title: `${AUTHOR_WORDS[j.author] ?? j.author}${how}, on a ${label} reading, ${toIso(j.created_at).slice(0, 10)}`,
    text: j.content,
    href: divinationPath(j.dkind, j.divination_id, j.reading_id),
    sourceId: j.divination_id,
  };
}

/** A tarot synthesis journal: the person's prompt and what came back (an AI wrote it). */
async function resolveSynthesis(userId: number, id: number): Promise<Resolved | null> {
  const s = await queryOne<{ prompt: string; content: string }>("SELECT prompt, content FROM synthesis_journals WHERE id = $1 AND user_id = $2", [id, userId]);
  if (!s) return null;
  return { title: `${s.prompt.trim().slice(0, 120)} (written by an AI)`, text: `Your prompt: ${s.prompt.trim()}\n\n${s.content}`, href: "/journals" };
}

/** A forum post the person can see (their own, or anyone's that is not hidden). The copy names its author. */
async function resolveForumPost(userId: number, id: number): Promise<Resolved | null> {
  const p = await queryOne<{ id: number; user_id: number; title: string; body: string; hidden_at?: string | null; username: string; display_name: string | null }>(
    "SELECT fp.*, u.username, u.display_name FROM forum_posts fp JOIN users u ON u.id = fp.user_id WHERE fp.id = $1",
    [id]
  );
  if (!p || (p.hidden_at && p.user_id !== userId)) return null;
  const by = p.display_name || p.username;
  return { title: `${p.title.slice(0, 160)} (by ${by})`, text: `${p.title}\n\n${p.body}`, href: `/forum/${p.id}`, sourceId: p.id };
}

/** A forum comment the person can see, with the post it was on as the place it came from. */
async function resolveForumComment(userId: number, id: number): Promise<Resolved | null> {
  const c = await queryOne<{ id: number; post_id: number; user_id: number; content: string; hidden_at: string | null; post_user: number; post_hidden: string | null; post_title: string; username: string; display_name: string | null }>(
    `SELECT fc.*, fp.user_id AS post_user, fp.hidden_at AS post_hidden, fp.title AS post_title, u.username, u.display_name
       FROM forum_comments fc JOIN forum_posts fp ON fp.id = fc.post_id JOIN users u ON u.id = fc.user_id WHERE fc.id = $1`,
    [id]
  );
  if (!c) return null;
  const hiddenComment = c.hidden_at && c.user_id !== userId;
  const hiddenPost = c.post_hidden && c.post_user !== userId;
  if (hiddenComment || hiddenPost) return null;
  const by = c.display_name || c.username;
  return { title: `By ${by}, on "${c.post_title.slice(0, 100)}"`, text: c.content, href: `/forum/${c.post_id}`, sourceId: c.post_id };
}

/** One of the person's predictions: what they expected, how they worded it first, and what they recorded afterwards. */
async function resolvePrediction(userId: number, id: number): Promise<Resolved | null> {
  const p = await queryOne<{ text: string; original_text: string; check_on: string | Date | null; outcome: Outcome | null; outcome_note: string | null; divination_id: number; kind: DivinationKind; reading_id: number | null }>(
    `SELECT p.text, p.original_text, p.check_on, p.outcome, p.outcome_note, d.id AS divination_id, d.kind, d.reading_id
       FROM predictions p JOIN divinations d ON d.id = p.divination_id WHERE p.id = $1 AND p.user_id = $2`,
    [id, userId]
  );
  if (!p) return null;
  const lines = [`You expected: ${p.text.trim()}`];
  if (p.original_text.trim() !== p.text.trim()) lines.push(`Your first wording: ${p.original_text.trim()}`);
  if (p.check_on) lines.push(`You wanted to look back on: ${toIso(p.check_on).slice(0, 10)}`);
  if (p.outcome) lines.push(`What you recorded: ${OUTCOME_LABELS[p.outcome]}${p.outcome_note?.trim() ? `. ${p.outcome_note.trim()}` : ""}`);
  else lines.push("You have not recorded what happened yet.");
  return { title: p.text.trim().slice(0, 140), text: lines.join("\n"), href: divinationPath(p.kind, p.divination_id, p.reading_id), sourceId: p.divination_id };
}

/** An answer to a question about a pattern, from the finished request (kept as a snapshot; the request itself is cleared after a day). */
async function resolvePatternAnswer(userId: number, id: number): Promise<Resolved | null> {
  const j = await queryOne<{ result: string; pattern_ref: string | null }>(
    "SELECT result, pattern_ref FROM companion_jobs WHERE id = $1 AND user_id = $2 AND mode = 'pattern' AND status = 'done' AND action = 'questions' AND result IS NOT NULL",
    [id, userId]
  );
  if (!j) return null;
  const who = (await queryOne<{ companion_name: string | null }>("SELECT companion_name FROM users WHERE id = $1", [userId]))?.companion_name?.trim() || "Companion";
  const name = j.pattern_ref ? await symbolName(userId, j.pattern_ref) : null;
  return { title: `Questions about ${name ?? "a pattern"}, written by ${who}, an AI`, text: j.result, href: "/insights" };
}

/** The resolvers for every kind that can be kept with a day. */
const RESOLVERS: Record<ItemKind, (userId: number, id: number) => Promise<Resolved | null>> = {
  reading: resolveReading,
  companion_note: resolveCompanionNote,
  journal_entry: resolveJournalEntry,
  synthesis_journal: resolveSynthesis,
  forum_post: resolveForumPost,
  forum_comment: resolveForumComment,
  prediction: resolvePrediction,
  pattern_answer: resolvePatternAnswer,
};

/** Whether what a snapshot's link back points at is still there: the reading for answers, entries and predictions, the post for a comment. */
async function sourceExists(kind: ItemKind, userId: number, sourceId: number): Promise<boolean> {
  if (kind === "forum_comment") return !!(await queryOne("SELECT 1 AS x FROM forum_posts WHERE id = $1", [sourceId]));
  return !!(await queryOne("SELECT 1 AS x FROM divinations WHERE id = $1 AND user_id = $2", [sourceId, userId]));
}

// --- A day ---

export interface DayItemView {
  id: number;
  kind: ItemKind;
  mode: ItemMode;
  title: string;
  text: string;
  href: string | null;
  /** The original has been deleted. A snapshot still holds what it said; a live link has nothing to show. */
  originGone: boolean;
  created_at: string;
}

export interface DayReading {
  id: number;
  kind: DivinationKind;
  label: string;
  summary: string;
  question: string | null;
  href: string;
  at: string;
}

export interface DayView {
  day: string;
  body: string;
  items: DayItemView[];
  /** The day's readings, listed by themselves; null when the person has turned that off. */
  readings: DayReading[] | null;
  prev: string | null;
  next: string | null;
}

async function listReadingsOn(userId: number, day: string): Promise<DayReading[]> {
  const { from, to } = dayWindow(day);
  const rows = await query<{ id: number; kind: DivinationKind; question: string | null; summary: string; reading_id: number | null; created_at: string | Date; sky: string | null }>(
    "SELECT id, kind, question, summary, reading_id, created_at, sky FROM divinations WHERE user_id = $1 AND created_at >= $2 AND created_at < $3 ORDER BY created_at, id",
    [userId, from, to]
  );
  const out: DayReading[] = [];
  for (const r of rows) {
    if (localDay(toIso(r.created_at), tzOfSky(r.sky)) !== day) continue;
    out.push({ id: r.id, kind: r.kind, label: DIVINATION_KIND_LABELS[r.kind] ?? r.kind, summary: r.summary, question: r.question, href: divinationPath(r.kind, r.id, r.reading_id), at: toIso(r.created_at) });
  }
  return out.slice(0, 100);
}

/** The most readings looked at when grouping a person's readings into days (the newest ones). */
const MAX_READINGS_TALLIED = 20000;

/**
 * The days the person made readings on, each with how many and which tools. A reading's day is its calendar date in the time zone saved with it,
 * which SQL cannot work out safely, so the grouping is done here (tallyReadingDays) from the time and the saved sky.
 */
async function readingDays(userId: number): Promise<Map<string, ReadingDayTally>> {
  const rows = await query<{ kind: string; created_at: string | Date; sky: string | null }>(
    "SELECT kind, created_at, sky FROM divinations WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2",
    [userId, MAX_READINGS_TALLIED]
  );
  return tallyReadingDays(rows.map((r) => ({ kind: r.kind, at: toIso(r.created_at), sky: r.sky })));
}

async function neighbour(userId: number, day: string, dir: "prev" | "next", readingDayList: string[]): Promise<string | null> {
  const cmp = dir === "prev" ? "<" : ">";
  const order = dir === "prev" ? "DESC" : "ASC";
  const row = await queryOne<{ day: string }>(
    `SELECT day::text AS day FROM (
       SELECT day FROM day_entries WHERE user_id = $1 AND body <> ''
       UNION SELECT day FROM day_items WHERE user_id = $1
     ) d WHERE day ${cmp} $2::date ORDER BY day ${order} LIMIT 1`,
    [userId, day]
  );
  // A day with readings counts too: the nearest of the two is the neighbour.
  const fromReadings = readingDayList.filter((d) => (dir === "prev" ? d < day : d > day)).sort();
  const candidates = [row?.day, dir === "prev" ? fromReadings.at(-1) : fromReadings[0]].filter((d): d is string => !!d).sort();
  return (dir === "prev" ? candidates.at(-1) : candidates[0]) ?? null;
}

/** One day for one person: their writing, what they kept, the day's readings (unless they turned that off), and the days either side that have something. */
export async function getDay(userId: number, day: string, listReadings: boolean): Promise<DayView> {
  const entry = await queryOne<{ body: string }>("SELECT body FROM day_entries WHERE user_id = $1 AND day = $2::date", [userId, day]);
  const rows = await query<{ id: number; kind: ItemKind; mode: ItemMode; ref_id: number; title: string | null; snapshot: string | null; href: string | null; source_id: number | null; created_at: string | Date }>(
    "SELECT id, kind, mode, ref_id, title, snapshot, href, source_id, created_at FROM day_items WHERE user_id = $1 AND day = $2::date ORDER BY id",
    [userId, day]
  );
  const items: DayItemView[] = [];
  for (const r of rows) {
    const resolver = RESOLVERS[r.kind];
    const now = resolver ? await resolver(userId, r.ref_id) : null;
    const gone = now === null;
    if (r.mode === "snapshot") {
      // The link back stays while what it points to is there: the original itself, or (for a kept answer) the reading it came from.
      const linkOk = !gone || r.kind === "pattern_answer" || (r.source_id !== null && (await sourceExists(r.kind, userId, r.source_id)));
      items.push({ id: r.id, kind: r.kind, mode: r.mode, title: r.title ?? "", text: r.snapshot ?? "", href: linkOk ? r.href : null, originGone: gone, created_at: toIso(r.created_at) });
    } else {
      items.push({ id: r.id, kind: r.kind, mode: r.mode, title: now?.title ?? r.title ?? "", text: now?.text ?? "", href: now?.href ?? null, originGone: gone, created_at: toIso(r.created_at) });
    }
  }
  const withReadings = listReadings ? [...(await readingDays(userId)).keys()] : [];
  const [readings, prev, next] = await Promise.all([
    listReadings ? listReadingsOn(userId, day) : Promise.resolve(null),
    neighbour(userId, day, "prev", withReadings),
    neighbour(userId, day, "next", withReadings),
  ]);
  return { day, body: entry?.body ?? "", items, readings, prev, next };
}

/** Saves the person's own writing for a day (an empty text clears it). */
export async function saveBody(userId: number, day: string, body: string): Promise<void> {
  await query(
    `INSERT INTO day_entries (user_id, day, body) VALUES ($1, $2::date, $3)
     ON CONFLICT (user_id, day) DO UPDATE SET body = EXCLUDED.body, updated_at = NOW()`,
    [userId, day, body]
  );
}

export type AddResult = { ok: true; id: number } | { ok: false; status: 400 | 404 | 409 | 503; error: string };

/**
 * Keeps something with a day. `mode` is the person's choice: a snapshot copies what it says now; a live link keeps only where it is. `linkBack` (on by
 * default) keeps the link to the original with a snapshot too. The original must be the person's own.
 */
export async function addItem(userId: number, day: string, kind: ItemKind, refId: number, mode: ItemMode, linkBack: boolean): Promise<AddResult> {
  if (!isValidDay(day)) return { ok: false, status: 400, error: "That is not a day I can use." };
  const resolver = RESOLVERS[kind];
  if (!resolver || !ADDABLE_NOW.includes(kind)) return { ok: false, status: 400, error: "That cannot be added to a day yet." };
  if (mode === "link" && SNAPSHOT_ONLY.includes(kind)) return { ok: false, status: 400, error: "That can only be kept as a snapshot." };
  if (!Number.isInteger(refId) || refId <= 0) return { ok: false, status: 400, error: "That is not a valid item." };
  const count = await queryOne<{ n: number }>("SELECT COUNT(*)::int AS n FROM day_items WHERE user_id = $1 AND day = $2::date", [userId, day]);
  if ((count?.n ?? 0) >= MAX_ITEMS_PER_DAY) return { ok: false, status: 409, error: `A day can hold ${MAX_ITEMS_PER_DAY} things. Remove some first.` };
  const original = await resolver(userId, refId);
  if (!original) return { ok: false, status: 404, error: "That is not there any more." };
  const row = await queryOne<{ id: number }>(
    `INSERT INTO day_items (user_id, day, kind, mode, ref_id, title, snapshot, href, source_id)
     VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT DO NOTHING RETURNING id`,
    [userId, day, kind, mode, refId, original.title.slice(0, 300), mode === "snapshot" ? original.text : null, mode === "link" || linkBack ? original.href : null, original.sourceId ?? null]
  );
  if (!row) return { ok: false, status: 409, error: mode === "snapshot" ? "A snapshot of that is already on this day." : "A link to that is already on this day." };
  return { ok: true, id: row.id };
}

export async function removeItem(userId: number, id: number): Promise<boolean> {
  return (await query("DELETE FROM day_items WHERE id = $1 AND user_id = $2 RETURNING id", [id, userId])).length > 0;
}

export interface DayListing {
  day: string;
  snippet: string;
  items: number;
  /** How many readings were made that day (0 when the person has turned listing them off). */
  readings: number;
  /** The tools those readings were made with, by their names, each once. */
  tools: string[];
}

/**
 * The person's days that have something in them, newest first (the newest 400 unless a bigger number is asked for). With `withReadings`, a day
 * they only made readings on counts too, so every reading has a place in the history; without it, only days they wrote on or kept something with.
 */
export async function listDays(userId: number, limit = 400, withReadings = false): Promise<DayListing[]> {
  const rows = await query<{ day: string; snippet: string | null; items: number }>(
    `WITH d AS (
       SELECT day FROM day_entries WHERE user_id = $1 AND body <> ''
       UNION SELECT day FROM day_items WHERE user_id = $1
     )
     SELECT d.day::text AS day,
            (SELECT left(e.body, 160) FROM day_entries e WHERE e.user_id = $1 AND e.day = d.day) AS snippet,
            (SELECT COUNT(*)::int FROM day_items i WHERE i.user_id = $1 AND i.day = d.day) AS items
       FROM d ORDER BY d.day DESC LIMIT $2`,
    [userId, limit]
  );
  const tally = withReadings ? await readingDays(userId) : new Map<string, ReadingDayTally>();
  const byDay = new Map<string, DayListing>(rows.map((r) => [r.day, { day: r.day, snippet: r.snippet ?? "", items: r.items, readings: 0, tools: [] }]));
  for (const [day, t] of tally) {
    const listing = byDay.get(day) ?? { day, snippet: "", items: 0, readings: 0, tools: [] };
    listing.readings = t.count;
    listing.tools = t.kinds.map((k) => DIVINATION_KIND_LABELS[k as DivinationKind] ?? k);
    byDay.set(day, listing);
  }
  return [...byDay.values()].sort((a, b) => b.day.localeCompare(a.day)).slice(0, limit);
}

export { addDays, isValidDay, MAX_DAY_BODY };
