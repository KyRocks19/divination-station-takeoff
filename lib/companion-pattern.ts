import { query } from "./db";
import { DIVINATION_KIND_LABELS } from "./divination-kinds";
import { parsePatternRef } from "./companion-pattern-ref";
import { MAX_CONTEXT_CHARS, type CompanionContext, type ContextEntry } from "./companion-context";
import { entriesFor } from "./companion-context-tools";
import { loadRecurring, loadShifts } from "./patterns-symbols";

// What the companion is given when the person asks a question about a pattern on the Patterns page (a symbol that keeps coming up, or one whose
// wording has shifted): the dates, the person's own entries about those readings, and their own wordings of the symbol, oldest first. Made in code from
// the person's own rows, so nothing is misdated or invented. It reads no stock meanings, rune poems, ogham texts, or theme names: like the other builders
// it imports no data file (tests/companion-context.test.ts checks the imports).

// How a pattern is named (and read back) is in lib/companion-pattern-ref.ts, which the Patterns page uses in the browser.
export { PATTERN_REF_RE, parsePatternRef, patternRef } from "./companion-pattern-ref";

export interface PatternInput {
  name: string;
  toolLabel: string;
  /** The readings it came up in (the most recent ones), oldest first, with the person's own entries about each. */
  readings: { when: string; question: string | null; entries: ContextEntry[] }[];
  /** How many more readings it came up in than are listed. */
  earlier: number;
  /** The person's own wordings of it, oldest first. */
  wordings: { when: string; text: string }[];
}

const ENTRY_LABEL: Record<ContextEntry["kind"], string> = {
  note: "You wrote",
  impression: "You wrote, as what you noticed first",
  lookback: "You wrote, looking back",
};
const day = (s: string) => s.slice(0, 10);

/** The pattern as plain text, every line the person's own words or a date. Oldest readings are dropped first if it is too long. */
export function formatPatternContext(i: PatternInput, limit = MAX_CONTEXT_CHARS): CompanionContext {
  const head = [`A pattern in your readings: ${i.name} (${i.toolLabel}).`];
  const count = i.readings.length + i.earlier;
  if (count > 0) head.push(`It came up in ${count} reading${count === 1 ? "" : "s"}${i.earlier > 0 ? `; the ${i.readings.length} most recent are set out below` : ""}.`);

  const blocks = i.readings.map((r) => {
    const lines = [`On ${day(r.when)} it came up.${r.question?.trim() ? ` Your question then: ${r.question.trim()}` : ""}`];
    for (const e of r.entries) {
      const mark = e.thinkingMind ? " (you marked this as your thinking mind rather than what you sensed)" : "";
      lines.push(`${ENTRY_LABEL[e.kind]} on ${e.when}${mark}: ${e.content.trim()}`);
    }
    return lines.join("\n");
  });
  const wordingBlock =
    i.wordings.length > 0 ? [`Your own wordings of ${i.name}, oldest first:`, ...i.wordings.map((w) => `On ${day(w.when)} you wrote as its meaning: ${w.text.trim()}`)].join("\n") : "";

  const build = (from: number) => [head.join("\n"), ...blocks.slice(from), wordingBlock].filter(Boolean).join("\n\n");
  let from = 0;
  while (build(from).length > limit && from < blocks.length) from++;
  return { text: build(from), truncated: from > 0, hasHistory: count > 1 || i.wordings.length > 1 };
}

/** The pattern for one person, or null when it is not theirs or there is nothing to say about it (not in their recurring symbols or wording shifts). */
export async function buildPatternContext(userId: number, ref: string): Promise<CompanionContext | null> {
  const parsed = parsePatternRef(ref);
  if (!parsed) return null;
  const only = [parsed.kind];
  const [recurring, shifts] = await Promise.all([loadRecurring(userId, only), loadShifts(userId, only)]);
  const rec = recurring.find((r) => r.key === parsed.key);
  const shift = shifts.find((s) => s.key === parsed.key);
  if (!rec && !shift) return null;

  const ids = rec?.entries.map((e) => e.id) ?? [];
  const [questions, entries] = ids.length
    ? await Promise.all([
        query<{ id: number; question: string | null }>("SELECT id, question FROM divinations WHERE user_id = $1 AND id = ANY($2)", [userId, ids]),
        entriesFor(userId, ids),
      ])
    : [[], new Map<number, ContextEntry[]>()];
  const questionOf = new Map(questions.map((q) => [q.id, q.question]));

  return formatPatternContext({
    name: (rec?.name ?? shift?.name) as string,
    toolLabel: DIVINATION_KIND_LABELS[parsed.kind],
    readings: (rec?.entries ?? []).map((e) => ({ when: e.when, question: questionOf.get(e.id) ?? null, entries: entries.get(e.id) ?? [] })),
    earlier: rec?.earlier ?? 0,
    wordings: shift?.versions ?? [],
  });
}

const SURFACE: Record<string, string> = { mirror: "dark mirror", ball: "crystal ball", water: "bowl of water" };

/** The person's own name for a pattern's symbol, from what they drew (a cheap lookup, used to title an answer kept with a day). */
export async function symbolName(userId: number, ref: string): Promise<string | null> {
  const p = parsePatternRef(ref);
  if (!p) return null;
  const one = async (sql: string, params: unknown[]) => (await query<{ name: string | null }>(sql, params))[0]?.name ?? null;
  switch (p.kind) {
    case "tarot": return one("SELECT MAX(card_name) AS name FROM card_draws WHERE user_id = $1 AND card_id = $2", [userId, p.key]);
    case "runes": return one("SELECT MAX(rune_name) AS name FROM rune_draws WHERE user_id = $1 AND rune_id = $2", [userId, p.key]);
    case "ogham": return one("SELECT MAX(stave_name) AS name FROM ogham_draws WHERE user_id = $1 AND stave_id = $2", [userId, p.key]);
    case "oracle": return one("SELECT MAX(card_name) AS name FROM oracle_pull_cards WHERE user_id = $1 AND COALESCE(card_id::text, 'name:' || card_name) = $2", [userId, p.key]);
    case "pendulum": return one("SELECT MAX(swing_name) AS name FROM pendulum_answers WHERE user_id = $1 AND COALESCE(swing_id::text, 'name:' || swing_name) = $2", [userId, p.key]);
    case "scrying": return SURFACE[p.key] ?? p.key;
    case "iching":
      return one(
        `SELECT MAX(name) AS name FROM (
           SELECT primary_name AS name, 'hexagram-' || primary_number AS key FROM iching_casts WHERE user_id = $1
           UNION ALL SELECT relating_name, 'hexagram-' || relating_number FROM iching_casts WHERE user_id = $1 AND relating_number IS NOT NULL
         ) t WHERE key = $2`,
        [userId, p.key]
      );
    case "geomancy": return one("SELECT MAX(figure_name) AS name FROM geomancy_figures WHERE user_id = $1 AND figure_id = $2", [userId, p.key]);
    // A word the person pulled from their own writing is its own name.
    case "bibliomancy": return p.key;
    // A log of signs and dreams and blind-target practice keep no symbol that recurs across readings, so a pattern about them has no name to give.
    case "playingcards": return one("SELECT MAX(card_name) AS name FROM playing_card_draws WHERE user_id = $1 AND 'playing-' || card_id = $2", [userId, p.key]);
    case "charms": return p.key.startsWith("charm-middle:") ? one("SELECT MAX(charm_name) AS name FROM charm_casts WHERE user_id = $1 AND lower(charm_name) = $2", [userId, p.key.slice(13)]) : null;
    case "signs": case "remoteview": case "tea": case "blots": return null;
    case "dice": {
      const [object, face] = p.key.split(":");
      return object === "coin" ? `coin: ${face}` : `${object} showing ${face}`;
    }
  }
}
