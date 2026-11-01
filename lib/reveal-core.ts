// The opening of a reading (owner's requests, 2026-10-25): a short animation and wait first, while the person holds their question in mind,
// with a line saying how the reading was made and which randomness method was used; then the person writes what they sense first (or skips
// that step); only then is the reading shown. This file touches no database code, so screens that run in the browser can import it.

import type { DivinationKind } from "./divination-kinds";

/** The picture that moves while a reading opens. */
export type RevealScene = "brew" | "ink" | "shuffle" | "bag" | "tumble" | "coins" | "dots" | "pages" | "swing" | "mist" | "glow";

export interface RevealSpec {
  scene: RevealScene;
  /** What is happening, as the start of a sentence: "Drawing your oracle cards". */
  action: string;
  /** True when chance made the reading, so the line names the randomness method. */
  random: boolean;
  /** How long the wait lasts before the reading is shown, in milliseconds. Long on purpose (owner's request, 2026-10-26: 15 s more
   *  each); the picture plays at its normal speed and loops for the whole wait (2026-10-29). "I am ready" and Escape end it early. */
  ms: number;
}

const SPECS: Record<DivinationKind, RevealSpec> = {
  tarot: { scene: "shuffle", action: "Shuffling and drawing your tarot cards", random: true, ms: 18500 },
  oracle: { scene: "shuffle", action: "Drawing your oracle cards", random: true, ms: 18500 },
  playingcards: { scene: "shuffle", action: "Drawing your playing cards", random: true, ms: 18500 },
  runes: { scene: "bag", action: "Drawing your runes from the bag", random: true, ms: 18500 },
  ogham: { scene: "bag", action: "Drawing your ogham staves", random: true, ms: 18500 },
  charms: { scene: "bag", action: "Casting your charms", random: true, ms: 18500 },
  dice: { scene: "tumble", action: "Throwing your dice", random: true, ms: 18000 },
  iching: { scene: "coins", action: "Casting your I Ching coins", random: true, ms: 19000 },
  geomancy: { scene: "dots", action: "Marking your geomancy chart", random: true, ms: 19000 },
  bibliomancy: { scene: "pages", action: "Opening your writings at random", random: true, ms: 18500 },
  pendulum: { scene: "swing", action: "Letting the pendulum swing", random: true, ms: 19000 },
  scrying: { scene: "mist", action: "Stilling the surface", random: false, ms: 19000 },
  signs: { scene: "glow", action: "Opening your note", random: false, ms: 17500 },
  remoteview: { scene: "glow", action: "Sealing the target", random: true, ms: 18000 },
  tea: { scene: "brew", action: "Brewing your tea and reading the leaves", random: true, ms: 21000 },
  blots: { scene: "ink", action: "Pressing your ink blot", random: true, ms: 19500 },
};

/** The reveal for a kind of reading. Tea leaves brew a cup; an ink blot presses ink (the two were one tool until 2026-10-29). */
export function revealSpec(kind: DivinationKind, opts: { random?: boolean } = {}): RevealSpec {
  const base = SPECS[kind];
  return opts.random === undefined ? base : { ...base, random: opts.random };
}

/** How each randomness method in Settings is named in the line (the same names as the Settings page). */
export const RNG_METHOD_NAMES: Record<string, string> = {
  math: "Math.random()",
  crypto: "crypto",
  "random.org": "random.org",
};

/**
 * The line shown near the bottom of the screen while a reading opens: "Drawing your oracle cards using the random.org method for
 * randomness…". Without a known method, or for a reading chance did not make, it is the action alone.
 */
export function revealLine(spec: RevealSpec, method: string | null): string {
  const name = method ? RNG_METHOD_NAMES[method] : undefined;
  return spec.random && name ? `${spec.action} using the ${name} method for randomness…` : `${spec.action}…`;
}

/** A reading opened within this long of being made is new, and its reveal plays even when the "sense first" step is off. */
export const FRESH_MS = 15 * 60 * 1000;

/**
 * Whether the animation plays: for a reading not yet opened in this browser tab that is new, or whose first impression is still to be
 * written (the person focuses on their question during it, then writes). Going back to an older reading, or one already opened in this
 * tab, skips it.
 */
export function shouldAnimate(o: { held: boolean; createdAt: string | null; now: number; seen: boolean }): boolean {
  if (o.seen) return false;
  if (o.held) return true;
  if (!o.createdAt) return false;
  const made = Date.parse(o.createdAt);
  return Number.isFinite(made) && o.now - made >= -60_000 && o.now - made < FRESH_MS;
}

/** The readings already shown in this tab (keys such as "d12"), kept in sessionStorage under this key as a comma-separated list. */
export const REVEALED_KEY = "ds-revealed";

/** The kept list, with anything that is not a plain key dropped; the newest 200 at most. */
export function parseRevealed(raw: string | null): string[] {
  if (!raw) return [];
  return raw.split(",").filter((k) => /^[a-z]{1,12}\d{1,12}$/.test(k)).slice(-200);
}

/** The words on a covered reading, below the "write what you sense first" card. */
export const COVERED_WORDS = {
  title: "Your reading is ready, and covered",
  body: "It is shown once you have written what you sense above, or skipped that step.",
  skipWait: "I am ready",
  holdQuestion: "Hold your question in mind",
  holdNoQuestion: "Breathe, and let your mind settle",
};
