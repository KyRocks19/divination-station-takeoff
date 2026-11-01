// A yearly review as a Markdown file (release plan §6 idea 8, owner decision 2026-10-22): built only from the person's own words and counts for
// one year, written as their own timeline, and downloaded to their device. Nothing is sent anywhere and nothing new is stored. It says what is
// there, never what it means. Pure: no database, so the tests can check it. lib/year-review.ts gathers the rows.

export interface YearReviewData {
  year: number;
  /** Readings that year, by tool name, most first. */
  readingsByTool: { tool: string; count: number }[];
  /** Symbols that came up in two or more readings that year. */
  recurring: { name: string; tool: string; days: string[] }[];
  /** Things the person worded more than once, with the wordings written that year (and the one before, for context). */
  shifts: { name: string; versions: { day: string; text: string }[] }[];
  /** What they sensed first that year, oldest first. */
  guesses: { day: string; tool: string; text: string; fit: string | null; note: string | null }[];
  /** Predictions written that year, oldest first. */
  predictions: { day: string; tool: string; text: string; outcome: string | null; note: string | null }[];
}

export function isReviewYear(value: unknown, now = new Date()): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 2000 && value <= now.getUTCFullYear();
}

/** One line of the person's words, as Markdown that cannot break the file: no heading or list marks at the start of a line. */
const quote = (text: string) => text.trim().split(/\r?\n/).map((line) => `> ${line}`).join("\n");

export function formatYearReview(d: YearReviewData): string {
  const out: string[] = [`# My year of readings, ${d.year}`, ""];
  out.push("Made by Divination Station from my own readings and my own words. It says what is there, not what it means.", "");

  const total = d.readingsByTool.reduce((sum, r) => sum + r.count, 0);
  out.push("## Readings", "");
  if (total === 0) out.push("No readings that year.", "");
  else {
    out.push(`${total} reading${total === 1 ? "" : "s"} in all.`, "");
    for (const r of d.readingsByTool) out.push(`- ${r.tool}: ${r.count}`);
    out.push("");
  }

  if (d.recurring.length) {
    out.push("## What kept coming up", "");
    for (const r of d.recurring) out.push(`- ${r.name} (${r.tool}): ${r.days.length} times, on ${r.days.join(", ")}`);
    out.push("");
  }

  if (d.shifts.length) {
    out.push("## How my wording changed", "");
    for (const s of d.shifts) {
      out.push(`### ${s.name}`, "");
      for (const v of s.versions) out.push(`${v.day}:`, "", quote(v.text), "");
    }
  }

  if (d.guesses.length) {
    out.push("## What I sensed first", "");
    const rated = d.guesses.filter((g) => g.fit);
    out.push(`${d.guesses.length} written before opening the meanings; I said how well ${rated.length} fitted.`, "");
    for (const g of d.guesses) {
      out.push(`${g.day}, ${g.tool}:`, "", quote(g.text), "");
      if (g.fit) out.push(`How well it fitted: ${g.fit}.${g.note ? ` ${g.note.trim()}` : ""}`, "");
    }
  }

  if (d.predictions.length) {
    out.push("## What I expected", "");
    for (const p of d.predictions) {
      out.push(`${p.day}, ${p.tool}:`, "", quote(p.text), "");
      out.push(p.outcome ? `Looking back: ${p.outcome}.${p.note ? ` ${p.note.trim()}` : ""}` : "Not looked back on yet.", "");
    }
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
