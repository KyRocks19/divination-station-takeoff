// Blind-target practice. Someone (the person, or a friend) writes four possible targets. The app picks one by chance and keeps it sealed. The person writes an
// impression first, which is then sealed too. Only after that are the four options shown, and the person chooses the one the impression matches best; then the
// target is shown. With four options, guessing alone gives the right one a quarter of the time, so the person's own results can be set beside that.
// This file touches no database code, so screens that run in the browser can import it.
//
// The app makes no claim about whether anyone can do better than chance. It keeps the person's own record and the arithmetic, and nothing more.

export const OPTION_COUNT = 4;
export const MAX_OPTION_CHARS = 80;
export const MAX_IMPRESSION_CHARS = 5000;

/** Four different targets, each trimmed and 1 to MAX_OPTION_CHARS long, or null. "Different" ignores capital letters and extra spaces. */
export function cleanOptions(v: unknown): string[] | null {
  if (!Array.isArray(v) || v.length !== OPTION_COUNT) return null;
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== "string") return null;
    const t = item.replace(/\s+/g, " ").trim();
    if (t.length === 0 || t.length > MAX_OPTION_CHARS) return null;
    out.push(t);
  }
  return new Set(out.map((t) => t.toLowerCase())).size === OPTION_COUNT ? out : null;
}

export function cleanImpression(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 && t.length <= MAX_IMPRESSION_CHARS ? t : null;
}

/** 0 to 3, or null. */
export function cleanChoice(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v < OPTION_COUNT ? v : null;
}

/** Which of the options is the target, each equally likely, with the random method the person chose in Settings. */
export function pickTarget(rng: () => number): number {
  return Math.min(OPTION_COUNT - 1, Math.floor(rng() * OPTION_COUNT));
}

/**
 * The chance of `hits` or more right choices out of `trials` by guessing alone, when each guess is right with chance `p` (0.25 for four options).
 * It adds the exact binomial terms, so it is correct for small numbers too.
 */
export function chanceOfAtLeast(hits: number, trials: number, p = 1 / OPTION_COUNT): number {
  if (trials <= 0 || hits <= 0) return 1;
  if (hits > trials) return 0;
  let term = Math.pow(1 - p, trials); // P(X = 0)
  let sum = hits === 0 ? term : 0;
  for (let k = 1; k <= trials; k++) {
    term = (term * (trials - k + 1) * p) / (k * (1 - p));
    if (k >= hits) sum += term;
  }
  return Math.min(1, sum);
}

/** The person's judged trials as a few plain numbers. `p` is the chance of a right choice by guessing (a quarter for four options, a fifth for five). */
export function practiceNumbers(trials: number, hits: number, p = 1 / OPTION_COUNT) {
  return { trials, hits, expected: trials * p, chance: chanceOfAtLeast(hits, trials, p) };
}

// Daily five-choice trials: one of five plain shapes is the target. The shapes are named in words as well as drawn, and mean nothing.
export const DAILY_OPTIONS = 5;
export const DAILY_SHAPES = ["Circle", "Square", "Triangle", "Star", "Wave"] as const;

/** 0 to 4, or null. */
export function cleanDailyChoice(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v < DAILY_OPTIONS ? v : null;
}

/** A quick drawing is checked with the drawing board's own rules (`cleanDrawing` in lib/oracle-art.ts), on the board of a card. */
export const IDEOGRAM_FORM = "cards";

/** A chance as words: "about 1 in 5" or "under 1 in 1,000". */
export function chanceWords(c: number): string {
  if (c >= 0.95) return "almost certain";
  if (c <= 0) return "none";
  const inN = 1 / c;
  if (inN > 1000) return "under 1 in 1,000";
  return `about 1 in ${Math.round(inN).toLocaleString("en-US")}`;
}

export type TrialState = "open" | "sealed" | "judged";

export const RV_WORDS = {
  here: "Practise writing down first impressions of something you cannot see. Someone writes four possible targets and the app picks one by chance and keeps it hidden. You write your impression, it is sealed so it cannot be changed, then you choose which of the four it matches best, and only then is the target shown.",
  blind: "For a fair test, someone else should write the four targets, so you do not know them. If you write them yourself you will know the options and your impression may be shaped by them. You can still keep a record that way, but it is a weaker test.",
  daily: "Each daily trial has five plain shapes. One is the target, picked by chance and kept hidden. You see a seal first (a code made from the target and a secret number). Choose a shape, and the target and the secret number are shown, so you can check the seal matches. Guessing alone is right one time in five.",
  honest: "With four options, choosing at random is right a quarter of the time. This page shows your own results next to that. A small number of trials cannot show much either way. The app does not claim that anyone can or cannot do better than chance.",
};
