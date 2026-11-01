// "Write what you sense first": the words, limits and counting for the guess a person can write before a reading's meanings are opened.
// No database and no files here, so client components and the tests can import it.

export const MAX_GUESS_LENGTH = 2000;
export const MAX_FIT_NOTE_LENGTH = 1000;
/** How many guesses with a "how well it fitted" answer a tool needs before an average is shown next to its count. */
export const MIN_FITS_FOR_AVERAGE = 5;

export const FITS = [1, 2, 3, 4, 5] as const;
export type Fit = (typeof FITS)[number];

export const FIT_LABELS: Record<Fit, string> = {
  1: "Not at all",
  2: "A little",
  3: "Partly",
  4: "Mostly",
  5: "Very well",
};

export interface Guess {
  divination_id: number;
  guess: string;
  skipped: boolean;
  sealed_at: string;
  fit: Fit | null;
  fit_note: string | null;
  fit_at: string | null;
  /** How sure the person felt when they sealed it, 1 to 5 (migration 092); null when not given. */
  confidence: Confidence | null;
  /** Whether the person ticked that the companion may read this guess (migration 092). Never on by default. */
  companion_ok: boolean;
  /** What the person's logical mind said, written beside the first impression (migration 096); null when not written. */
  logic: string | null;
}

export type Confidence = Fit;

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  1: "Not sure at all",
  2: "A little sure",
  3: "Somewhat sure",
  4: "Quite sure",
  5: "Very sure",
};

/** How sure the person felt: 1 to 5, or null (not given). `undefined` when it is something else. */
export function cleanConfidence(value: unknown): Confidence | null | undefined {
  if (value === null || value === undefined) return null;
  return typeof value === "number" && (FITS as readonly number[]).includes(value) ? (value as Confidence) : undefined;
}

export function cleanGuessText(value: unknown): { ok: true; text: string } | { ok: false; error: string } {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return { ok: false, error: "Write what you sense, or choose to skip this step." };
  if (text.length > MAX_GUESS_LENGTH) return { ok: false, error: `That is too long (${MAX_GUESS_LENGTH} characters at most).` };
  return { ok: true, text };
}

/** What the logical mind said: optional, trimmed, empty becomes null, `undefined` when too long or not text. */
export function cleanLogicText(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (text.length > MAX_GUESS_LENGTH) return undefined;
  return text || null;
}

export function cleanFit(value: unknown): Fit | null | undefined {
  if (value === null) return null;
  return typeof value === "number" && (FITS as readonly number[]).includes(value) ? (value as Fit) : undefined;
}

/** A note about the fit: trimmed, empty becomes null, `undefined` when too long or not text. */
export function cleanFitNote(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (text.length > MAX_FIT_NOTE_LENGTH) return undefined;
  return text || null;
}

/** What the browser knows about the step on one reading. `stepOn` is false when the person turned it off or the copy lacks migration 090. */
export interface GuessState {
  loaded: boolean;
  stepOn: boolean;
  guess: Guess | null;
}

/** Whether the meanings of a reading are held back: until the answer is known, and then while the step is on and nothing has been written or set aside. */
export function meaningsHeldBack(state: GuessState): boolean {
  return !state.loaded || (state.stepOn && state.guess === null);
}

export interface GuessCounts {
  /** Guesses the person wrote (set-aside ones are not counted). */
  written: number;
  /** Of those, how many have a fit answer. */
  rated: number;
  /** Sum of the fit answers, for the average. */
  fitTotal: number;
}

export const emptyCounts = (): GuessCounts => ({ written: 0, rated: 0, fitTotal: 0 });

/** Counts per key (a tool) from rows of written guesses. Set-aside rows must not be passed in. */
export function countGuesses<K extends string>(rows: { key: K; fit: Fit | null }[]): Map<K, GuessCounts> {
  const map = new Map<K, GuessCounts>();
  for (const r of rows) {
    const c = map.get(r.key) ?? emptyCounts();
    c.written += 1;
    if (r.fit !== null) {
      c.rated += 1;
      c.fitTotal += r.fit;
    }
    map.set(r.key, c);
  }
  return map;
}

/** The average fit as a number with one decimal, or null before there are enough answers to mean something. */
export function averageFit(c: GuessCounts): number | null {
  if (c.rated < MIN_FITS_FOR_AVERAGE) return null;
  return Math.round((c.fitTotal / c.rated) * 10) / 10;
}

export interface FitMonth {
  /** YYYY-MM of when the guesses were sealed (UTC, as the database gives it). */
  month: string;
  /** How many guesses sealed that month got each answer. */
  counts: Record<Fit, number>;
  rated: number;
  /** The average answer, or null before there are enough answers that month to mean something. */
  average: number | null;
}

/** How well the person said their guesses fitted, month by month (newest first), for Patterns (GF1 f). Rows without an answer are left out. */
export function fitsByMonth(rows: { sealed_at: string; fit: Fit | null }[]): FitMonth[] {
  const months = new Map<string, FitMonth>();
  for (const r of rows) {
    if (r.fit === null) continue;
    const month = r.sealed_at.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    const m = months.get(month) ?? { month, counts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, rated: 0, average: null };
    m.counts[r.fit] += 1;
    m.rated += 1;
    months.set(month, m);
  }
  return [...months.values()]
    .map((m) => {
      const total = FITS.reduce((sum, f) => sum + f * m.counts[f], 0);
      return { ...m, average: averageFit({ written: m.rated, rated: m.rated, fitTotal: total }) };
    })
    .sort((a, b) => b.month.localeCompare(a.month));
}

/** A fit answer of "Mostly" or "Very well": what the confidence counts call fitting well. */
export const FITTED_WELL = 4;

export interface ConfidenceRow {
  confidence: Confidence;
  /** Guesses sealed with this confidence that have a fit answer. */
  rated: number;
  /** Of those, how many the person said fitted mostly or very well. */
  fittedWell: number;
}

/**
 * How sure the person felt against how well they later said it fitted (release plan §6 idea 1): for each level of confidence, how many answers
 * and how many fitted well. Rows with no confidence or no fit answer are left out. Highest confidence first. Plain counts, never a grade.
 */
export function confidenceVsFit(rows: { confidence: Confidence | null; fit: Fit | null }[]): ConfidenceRow[] {
  const by = new Map<Confidence, ConfidenceRow>();
  for (const r of rows) {
    if (r.confidence === null || r.fit === null) continue;
    const c = by.get(r.confidence) ?? { confidence: r.confidence, rated: 0, fittedWell: 0 };
    c.rated += 1;
    if (r.fit >= FITTED_WELL) c.fittedWell += 1;
    by.set(r.confidence, c);
  }
  return [...by.values()].sort((a, b) => b.confidence - a.confidence);
}

export interface TagFit {
  tag: string;
  rated: number;
  /** Average fit, or null before MIN_FITS_FOR_AVERAGE answers. */
  average: number | null;
}

/**
 * How well guesses fitted on readings with each of the person's tags (release plan §6 idea 3: conditions such as rested or rushed). A reading
 * with two tags counts under both. Most answers first. There is no chance figure for how well words fit, so the page sets each tag beside the
 * person's own average over every rated guess (`overallFit`).
 */
export function fitByTag(rows: { tag: string; fit: Fit }[]): TagFit[] {
  const by = new Map<string, GuessCounts>();
  for (const r of rows) {
    const c = by.get(r.tag) ?? emptyCounts();
    c.written += 1;
    c.rated += 1;
    c.fitTotal += r.fit;
    by.set(r.tag, c);
  }
  return [...by.entries()]
    .map(([tag, c]) => ({ tag, rated: c.rated, average: averageFit(c) }))
    .sort((a, b) => b.rated - a.rated || a.tag.localeCompare(b.tag));
}

/** The person's average fit over every rated guess, or null before enough answers. */
export function overallFit(fits: Fit[]): number | null {
  return averageFit({ written: fits.length, rated: fits.length, fitTotal: fits.reduce((sum, f) => sum + f, 0) });
}
