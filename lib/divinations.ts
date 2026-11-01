import type { PoolClient } from "pg";
import { query } from "./db";
import type { DivinationKind } from "./divination-kinds";

export {
  DIVINATION_KIND_ICONS,
  DIVINATION_KIND_LABELS,
  DIVINATION_KIND_PAGES,
  DIVINATION_KINDS,
  SHOW_ALL_PARAM,
  divinationPath,
  isWidened,
  parseChosenTools,
  toolFilterHref,
  toolNames,
  type DivinationKind,
} from "./divination-kinds";

// The `divinations` table (migration 020) is the part every kind of reading shares: who, when, which tool,
// the question, the sky, and one line saying what came up. Journals and comparisons point at it, so readings
// of different kinds can be set side by side. Each kind keeps its own tables for its own details.
// The kinds themselves (names, labels, pages) live in lib/divination-kinds.ts so the browser can import them.

export interface NewDivination {
  userId: number;
  kind: DivinationKind;
  title?: string | null;
  question: string | null;
  /** One plain line saying what came up, as it was at the time. */
  summary: string;
  /** JSON snapshot of the sky when the reading was made (see lib/sky.ts). */
  sky: string;
  /** Tarot only: the reading in `readings` that this record stands for (migration 023). */
  readingId?: number;
  /** The layout the person drew with (migration 029), and its name as it was then. Empty for a draw with no layout. */
  layoutId?: number | null;
  layoutName?: string | null;
}

/** Adds the shared record for a reading. Call it inside the transaction that also writes the kind's own rows. */
export async function insertDivination(client: PoolClient, d: NewDivination): Promise<number> {
  const { rows } = await client.query(
    `INSERT INTO divinations (user_id, kind, title, question, summary, sky, reading_id, layout_id, layout_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [d.userId, d.kind, d.title ?? null, d.question, d.summary, d.sky, d.readingId ?? null, d.layoutId ?? null, d.layoutName ?? null]
  );
  return rows[0].id;
}

/**
 * How many readings the person has made with tools outside `shown`, for "Show everything (5 more)". `shown` is the
 * saved choice of tools; null means every tool is shown, so nothing is left out.
 */
export async function countReadingsNotIn(userId: number, shown: DivinationKind[] | null): Promise<number> {
  if (shown === null) return 0;
  const rows = await query<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM divinations WHERE user_id = $1 AND NOT (kind = ANY($2::text[]))",
    [userId, shown]
  );
  return rows[0]?.n ?? 0;
}

/**
 * How many journal entries (and, with tarot out of the choice, tarot syntheses) belong to tools outside `shown`.
 * An entry with no shared record is about a tarot reading, as on the Journals page itself.
 */
export async function countEntriesNotIn(userId: number, shown: DivinationKind[] | null): Promise<number> {
  if (shown === null) return 0;
  const rows = await query<{ n: number }>(
    `SELECT (
       (SELECT COUNT(*) FROM journals j
          LEFT JOIN readings r ON r.id = j.reading_id
          LEFT JOIN divinations d ON d.id = j.divination_id
        WHERE COALESCE(r.user_id, d.user_id) = $1 AND NOT (COALESCE(d.kind, 'tarot') = ANY($2::text[])))
       + (CASE WHEN 'tarot' = ANY($2::text[]) THEN 0 ELSE (SELECT COUNT(*) FROM synthesis_journals WHERE user_id = $1) END)
     )::int AS n`,
    [userId, shown]
  );
  return rows[0]?.n ?? 0;
}

/** The one-line summary of a tarot reading: its card names in order, with "(reversed)" where a card was. Matches migration 023. */
export function tarotSummary(cards: { card_name: string; reversed?: boolean }[]): string {
  return cards.map((c) => c.card_name + (c.reversed ? " (reversed)" : "")).join(", ");
}

// What a person writes about a reading lives in the `journals` table, the same one tarot readings use
// (migration 022): a tarot entry has reading_id, an entry about any other kind has divination_id.

/**
 * The kinds of entry a person can write about a reading. An impression is what they noticed first, before
 * reading their own earlier words. A look-back says what happened afterwards.
 */
export const ENTRY_KINDS = ["note", "impression", "lookback"] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

/** One thing the person wrote about a reading. */
export interface DivinationEntry {
  id: number;
  kind: EntryKind;
  /** 1 when the person marked it as their thinking mind talking rather than what they sensed (migration 045). */
  thinking_mind: number;
  content: string;
  created_at: string;
}

/** An interview the AI interviewer saved for a reading (open item C6): not the person's own writing, so it is listed apart from `listEntries`. */
export interface SavedInterview {
  id: number;
  content: string;
  created_at: string;
}

/** The interviews saved for one reading, oldest first. Empty when the reading is not theirs. */
export async function listInterviews(userId: number, divinationId: number): Promise<SavedInterview[]> {
  return query<SavedInterview>(
    `SELECT j.id, j.content, j.created_at
     FROM journals j JOIN divinations d ON d.id = j.divination_id
     WHERE j.divination_id = $1 AND d.user_id = $2 AND j.author = 'interview'
     ORDER BY j.created_at ASC, j.id ASC`,
    [divinationId, userId]
  );
}

/** The guide's entries the person kept with a reading of any tool but tarot (Y3), oldest first, apart from their own writing. Empty when it is not theirs. */
export async function listGuideEntries(userId: number, divinationId: number): Promise<SavedInterview[]> {
  return query<SavedInterview>(
    `SELECT j.id, j.content, j.created_at
     FROM journals j JOIN divinations d ON d.id = j.divination_id
     WHERE j.divination_id = $1 AND d.user_id = $2 AND j.author = 'guide'
     ORDER BY j.created_at ASC, j.id ASC`,
    [divinationId, userId]
  );
}

/** What the person wrote about one reading, oldest first. Empty when the reading is not theirs. */
export async function listEntries(userId: number, divinationId: number): Promise<DivinationEntry[]> {
  return query<DivinationEntry>(
    `SELECT j.id, j.kind, j.thinking_mind, j.content, j.created_at
     FROM journals j JOIN divinations d ON d.id = j.divination_id
     WHERE j.divination_id = $1 AND d.user_id = $2 AND j.author = 'user'
     ORDER BY j.created_at ASC, j.id ASC`,
    [divinationId, userId]
  );
}
