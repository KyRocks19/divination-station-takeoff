import { query } from "./db";
import { toISOString } from "./date";
import { DIVINATION_KIND_LABELS, type DivinationKind } from "./divination-kinds";
import { FIT_LABELS, type Fit } from "./guess-core";
import { OUTCOME_LABELS, type Outcome } from "./prediction-words";
import { loadRecurring, loadShifts } from "./patterns-symbols";
import type { YearReviewData } from "./year-review-core";

// Gathers one year of the person's own readings and words for the yearly review (lib/year-review-core.ts formats it). Scoped to the person.
// Symbols that kept coming up use the same dated lists as Patterns, which name the most recent dates of each symbol; the review keeps those that
// fall in the year.

const toolName = (k: string) => DIVINATION_KIND_LABELS[k as DivinationKind] ?? "Reading";
const day = (d: string | Date) => toISOString(d).slice(0, 10);

export async function loadYearReview(userId: number, year: number): Promise<YearReviewData> {
  const from = `${year}-01-01`;
  const to = `${year + 1}-01-01`;
  const inYear = (d: string | Date) => day(d).startsWith(String(year));

  const [byTool, recurring, shifts] = await Promise.all([
    query<{ kind: string; count: string }>(
      "SELECT kind, COUNT(*)::text AS count FROM divinations WHERE user_id = $1 AND created_at >= $2 AND created_at < $3 GROUP BY kind ORDER BY COUNT(*) DESC, kind",
      [userId, from, to]
    ),
    loadRecurring(userId, null),
    loadShifts(userId, null),
  ]);

  const guesses = await query<{ guess: string; sealed_at: string | Date; fit: Fit | null; fit_note: string | null; kind: string }>(
    `SELECT g.guess, g.sealed_at, g.fit, g.fit_note, d.kind FROM reading_guesses g JOIN divinations d ON d.id = g.divination_id
     WHERE g.user_id = $1 AND d.user_id = $1 AND NOT g.skipped AND g.sealed_at >= $2 AND g.sealed_at < $3 ORDER BY g.sealed_at`,
    [userId, from, to]
  );

  const predictions = await query<{ text: string; created_at: string | Date; outcome: Outcome | null; outcome_note: string | null; kind: string }>(
    `SELECT p.text, p.created_at, p.outcome, p.outcome_note, d.kind FROM predictions p JOIN divinations d ON d.id = p.divination_id
     WHERE p.user_id = $1 AND d.user_id = $1 AND p.created_at >= $2 AND p.created_at < $3 ORDER BY p.created_at`,
    [userId, from, to]
  );

  return {
    year,
    readingsByTool: byTool.map((r) => ({ tool: toolName(r.kind), count: Number(r.count) })),
    recurring: recurring
      .map((r) => ({ name: r.name, tool: toolName(r.kind), days: r.entries.filter((e) => inYear(e.when)).map((e) => day(e.when)) }))
      .filter((r) => r.days.length >= 2),
    shifts: shifts
      .map((s) => {
        const before = s.versions.filter((v) => day(v.when) < from);
        const during = s.versions.filter((v) => inYear(v.when));
        const shown = [...before.slice(-1), ...during];
        return { name: s.name, versions: during.length && shown.length >= 2 ? shown.map((v) => ({ day: day(v.when), text: v.text })) : [] };
      })
      .filter((s) => s.versions.length > 0),
    guesses: guesses.map((g) => ({ day: day(g.sealed_at), tool: toolName(g.kind), text: g.guess, fit: g.fit ? FIT_LABELS[g.fit].toLowerCase() : null, note: g.fit_note })),
    predictions: predictions.map((p) => ({
      day: day(p.created_at),
      tool: toolName(p.kind),
      text: p.text,
      outcome: p.outcome ? OUTCOME_LABELS[p.outcome].toLowerCase() : null,
      note: p.outcome_note,
    })),
  };
}
