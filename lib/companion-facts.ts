import { DIVINATION_KIND_LABELS, type DivinationKind } from "./divination-kinds";

// What the app counts about how a person uses it (slice 6h). Plain counts, made in code: no model, no judgement, and none of the person's words.
// Browser-safe (no database here). The loader that reads the counts is lib/companion-noticed.ts.

export interface Facts {
  /** Readings made, by tool. */
  byKind: Partial<Record<DivinationKind, number>>;
  /** Readings the person has written at least one entry about. */
  readingsWithWriting: number;
  /** The person's own entries, by kind. */
  entries: { note: number; impression: number; lookback: number };
  /** Entries the person marked as their thinking mind. */
  thinkingMind: number;
}

export const emptyFacts = (): Facts => ({ byKind: {}, readingsWithWriting: 0, entries: { note: 0, impression: 0, lookback: 0 }, thinkingMind: 0 });

export const totalReadings = (f: Facts) => Object.values(f.byKind).reduce((s, n) => s + (n ?? 0), 0);

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The counts as plain lines. Empty when there is nothing to count yet. */
export function factLines(f: Facts): string[] {
  const total = totalReadings(f);
  if (total === 0) return [];
  const kinds = (Object.entries(f.byKind) as [DivinationKind, number][])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || DIVINATION_KIND_LABELS[a[0]].localeCompare(DIVINATION_KIND_LABELS[b[0]]))
    .map(([k, n]) => `${n} with ${DIVINATION_KIND_LABELS[k]}`);
  const lines = [`You have made ${plural(total, "reading")}: ${kinds.join(", ")}.`];
  if (f.readingsWithWriting > 0) lines.push(`You wrote about ${f.readingsWithWriting} of them.`);
  else lines.push("You have not written about any of them yet.");
  const e = f.entries;
  const parts = [
    e.note > 0 ? plural(e.note, "note") : "",
    e.impression > 0 ? plural(e.impression, "first impression") : "",
    e.lookback > 0 ? plural(e.lookback, "look-back") : "",
  ].filter(Boolean);
  if (parts.length > 0) lines.push(`Your entries: ${parts.join(", ")}.`);
  if (f.thinkingMind > 0) lines.push(`You marked ${plural(f.thinkingMind, "entry", "entries")} as your thinking mind rather than what you sensed.`);
  return lines;
}

/** The text the app would hand the model when asked for a suggested line: the counts, said to be counts. Null when there is nothing to count. */
export function factsContext(f: Facts): string | null {
  const lines = factLines(f);
  if (lines.length === 0) return null;
  return ["Counted by the app from the person's readings. These are counts, not their words:", ...lines].join("\n");
}
