import { query } from "./db";
import { emptyFacts, factsContext, type Facts } from "./companion-facts";
import type { DivinationKind } from "./divination-kinds";
import type { CompanionContext } from "./companion-context";

// Reads the counts for slice 6h from the person's own rows (how many readings with each tool, how many entries of each kind). It reads no text
// of the person's, no stock meanings, and nothing about anyone else. Like the other context builders it imports no data file
// (tests/companion-context.test.ts checks it).

export async function loadFacts(userId: number): Promise<Facts> {
  const facts = emptyFacts();
  const kinds = await query<{ kind: DivinationKind; n: number }>("SELECT kind, COUNT(*)::int AS n FROM divinations WHERE user_id = $1 GROUP BY kind", [userId]);
  for (const r of kinds) facts.byKind[r.kind] = r.n;

  // The person's own entries about a reading of any tool: tarot entries point at the tarot reading, the others at the shared record.
  const join = `journals j JOIN divinations d ON (d.id = j.divination_id OR (j.reading_id IS NOT NULL AND d.reading_id = j.reading_id))`;
  const rows = await query<{ kind: string | null; thinking_mind: number; n: number }>(
    `SELECT j.kind, j.thinking_mind, COUNT(*)::int AS n FROM ${join} WHERE d.user_id = $1 AND j.author = 'user' GROUP BY j.kind, j.thinking_mind`,
    [userId]
  );
  for (const r of rows) {
    const key = r.kind === "impression" ? "impression" : r.kind === "lookback" ? "lookback" : "note";
    facts.entries[key] += r.n;
    if (r.thinking_mind === 1) facts.thinkingMind += r.n;
  }
  const [{ n }] = await query<{ n: number }>(`SELECT COUNT(DISTINCT d.id)::int AS n FROM ${join} WHERE d.user_id = $1 AND j.author = 'user'`, [userId]);
  facts.readingsWithWriting = n;
  return facts;
}

/** The counts as the context for a suggested line. Null when the person has nothing to count yet. */
export async function buildNoticedContext(userId: number): Promise<CompanionContext | null> {
  const text = factsContext(await loadFacts(userId));
  return text === null ? null : { text, truncated: false, hasHistory: false };
}
