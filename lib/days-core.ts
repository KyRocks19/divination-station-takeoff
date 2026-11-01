// The daily journal's plain rules (slice "days"): what a day is, which kinds of thing can be kept with one, and how a reading becomes the words of a
// snapshot. Pure: no database here, so pages can import it and tests need no database. The queries are in lib/days.ts.

/** A day is a calendar date written YYYY-MM-DD, in the person's own time zone. */
export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar date in a sensible range (2000 up to two days past today in UTC, which covers every time zone). */
export function isValidDay(day: unknown, now = new Date()): day is string {
  if (typeof day !== "string" || !DAY_RE.test(day)) return false;
  const [y, m, d] = day.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d);
  const check = new Date(t);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return false;
  return y >= 2000 && t <= now.getTime() + 2 * 86_400_000;
}

/** The day before or after, as YYYY-MM-DD. */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/**
 * The calendar date an instant fell on in a time zone (the one saved with a reading; UTC when none was). Null only for a time zone that is not valid,
 * which falls back to UTC at the caller.
 */
export function localDay(instantIso: string, tz: string | null | undefined): string {
  const date = new Date(instantIso);
  try {
    // "en-CA" writes the date as YYYY-MM-DD.
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz || "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/** The span of UTC instants that could fall on a given local day in any time zone (from 14 hours before to 36 hours after its UTC start). */
export function dayWindow(day: string): { from: Date; to: Date } {
  const [y, m, d] = day.split("-").map(Number);
  const start = Date.UTC(y, m - 1, d);
  return { from: new Date(start - 14 * 3_600_000), to: new Date(start + 36 * 3_600_000) };
}

export const ITEM_KINDS = ["reading", "companion_note", "synthesis_journal", "forum_post", "forum_comment", "journal_entry", "prediction", "pattern_answer"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];
export const isItemKind = (k: unknown): k is ItemKind => ITEM_KINDS.includes(k as ItemKind);

/** The kinds that can be added to a day: every kind the table allows has a button and a resolver. */
export const ADDABLE_NOW: ItemKind[] = [...ITEM_KINDS];

export const KIND_LABELS: Record<ItemKind, string> = {
  reading: "Reading",
  companion_note: "Kept answer",
  synthesis_journal: "Synthesis",
  forum_post: "Forum post",
  forum_comment: "Forum comment",
  journal_entry: "Journal entry",
  prediction: "Prediction",
  pattern_answer: "Pattern question",
};

/** Kinds that can only be kept as a snapshot: an answer to a pattern question lives only until the person clears it, so there is nothing to link to. */
export const SNAPSHOT_ONLY: ItemKind[] = ["pattern_answer"];

export type ItemMode = "snapshot" | "link";
export const isItemMode = (m: unknown): m is ItemMode => m === "snapshot" || m === "link";

export const MAX_DAY_BODY = 20000;
export const MAX_SNAPSHOT = 20000;
export const MAX_ITEMS_PER_DAY = 100;

/** One of the person's own entries on a reading, as the snapshot shows it. */
export interface SnapshotEntry {
  /** YYYY-MM-DD */
  when: string;
  kind: "note" | "impression" | "lookback";
  thinkingMind: boolean;
  content: string;
}

const ENTRY_WORDS: Record<SnapshotEntry["kind"], string> = { note: "You wrote", impression: "You wrote, as what you noticed first", lookback: "You wrote, looking back" };

/** The words a snapshot of a whole reading keeps: what came up, the question, and the person's own entries about it. No meaning is added. */
export function readingSnapshot(r: { question: string | null; summary: string; layoutName: string | null; toolLabel: string; entries: SnapshotEntry[] }): string {
  const lines = [`${r.toolLabel}${r.layoutName ? `, ${r.layoutName}` : ""}.`];
  if (r.question?.trim()) lines.push(`Your question: ${r.question.trim()}`);
  if (r.summary.trim()) lines.push(`What came up: ${r.summary.trim()}`);
  if (r.entries.length > 0) {
    lines.push("", "What you wrote about it:");
    for (const e of r.entries) lines.push(`- ${ENTRY_WORDS[e.kind]} on ${e.when}${e.thinkingMind ? " (marked as your thinking mind)" : ""}: ${e.content.trim()}`);
  }
  return lines.join("\n").slice(0, MAX_SNAPSHOT);
}

/** The time zone saved with a reading (inside its `sky` JSON), or null when there is none or it cannot be read. */
export function tzOfSky(sky: string | null | undefined): string | null {
  if (!sky) return null;
  try {
    const tz = JSON.parse(sky)?.tz;
    return typeof tz === "string" ? tz : null;
  } catch {
    return null;
  }
}

/** How many readings fell on one day, and with which tools (each tool once, in the order first used that day). */
export interface ReadingDayTally {
  count: number;
  kinds: string[];
}

/** Groups readings by the calendar date each was made on, in the time zone saved with it (UTC when none was). */
export function tallyReadingDays(rows: { kind: string; at: string; sky: string | null }[]): Map<string, ReadingDayTally> {
  const out = new Map<string, ReadingDayTally>();
  for (const r of [...rows].sort((a, b) => a.at.localeCompare(b.at))) {
    const day = localDay(r.at, tzOfSky(r.sky));
    const t = out.get(day) ?? { count: 0, kinds: [] };
    t.count += 1;
    if (!t.kinds.includes(r.kind)) t.kinds.push(r.kind);
    out.set(day, t);
  }
  return out;
}
