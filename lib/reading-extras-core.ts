import type { DivinationKind } from "./divination-kinds";

// The look-back reminder and "the same question with other tools" (release plan §6 ideas 2 and 5): the words and rules, with no database code,
// so the reading pages in the browser and the tests can use them. lib/reading-extras.ts reads and writes.

export interface SameQuestionReading {
  id: number;
  kind: DivinationKind;
  tool: string;
  href: string;
  /** ISO time of the reading. */
  when: string;
  /** What the person sensed first on it, or null when they wrote nothing first. */
  guess: string | null;
  fit: number | null;
}

export interface QuestionGroup {
  question: string;
  readings: SameQuestionReading[];
}

/** Two questions are the same when their words are, ignoring case and spacing. Null for no question. Must match KEY_SQL in reading-extras.ts. */
export function questionKey(question: string | null | undefined): string | null {
  const key = (question ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  return key || null;
}

export type LookBackChoice = "week" | "month";

export const LOOK_BACK_CHOICES: { id: LookBackChoice; label: string; days: number }[] = [
  { id: "week", label: "In a week", days: 7 },
  { id: "month", label: "In a month", days: 30 },
];

/** The reminder day for a choice, counted from `today` (YYYY-MM-DD, the person's own calendar day). */
export function lookBackDay(today: string, choice: LookBackChoice): string {
  const days = LOOK_BACK_CHOICES.find((c) => c.id === choice)!.days;
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** A reminder day sent by the page: a real YYYY-MM-DD date, or null to clear it. `undefined` when it is neither. */
export function cleanLookBackDay(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const d = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value ? value : undefined;
}
