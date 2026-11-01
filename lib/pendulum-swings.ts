// The swings a pendulum can make, and the words for them. This file touches no database code, so screens that
// run in the browser can import it. lib/pendulum.ts re-exports everything here.

/** What a swing does: moves along a line, goes round in a circle either way, or does not move. */
export type SwingShape = "line" | "circle_cw" | "circle_ccw" | "still";

/**
 * The five swings every person starts with, in the order they are listed. A line's angle is in degrees,
 * clockwise from straight up and down on the board, which is seen from above.
 * Back and forth is 0 degrees and side to side is 90.
 */
export const BUILTIN_SWINGS: { shape: SwingShape; angle: number | null }[] = [
  { shape: "line", angle: 0 },
  { shape: "line", angle: 90 },
  { shape: "circle_cw", angle: null },
  { shape: "circle_ccw", angle: null },
  { shape: "still", angle: null },
];

/** The whole-degree part of the largest angle: angles run from 0 up to, but not including, 180, because a line at 180 degrees is the line at 0. */
export const LAST_ANGLE = 179;

/** The largest angle, in degrees, to a tenth. */
export const LAST_ANGLE_EXACT = 179.9;

/** The longest name a person can give an added swing. */
export const MAX_SWING_NAME_LENGTH = 80;

/** How many swings a person can have in all. Several can share one angle, so the angles alone do not set a limit. */
export const MAX_SWINGS = 2000;

/** An angle from 0 to 179.9 in steps of a tenth of a degree, or null when the value is anything else. */
export function cleanAngle(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > LAST_ANGLE_EXACT) return null;
  const tenths = Math.round(value * 10);
  return Math.abs(tenths - value * 10) < 1e-6 ? tenths / 10 : null;
}

/** An angle as whole degrees and tenths, the way it is kept: 45.3 is 45 and 3. */
export function splitAngle(angle: number): { whole: number; tenths: number } {
  const total = Math.round(angle * 10);
  return { whole: Math.floor(total / 10), tenths: total % 10 };
}

/** An angle as text with no needless decimals: "45", "45.3". */
export function formatAngle(angle: number): string {
  return Number.isInteger(angle) ? String(angle) : angle.toFixed(1);
}

/**
 * The id a line's own links are kept under ("swing-line-45"). The tenth is left out on purpose: links, counts and the
 * common meanings are kept by whole degree, so a line at 45.3 shares them with the line at 45.
 */
export function lineSymbolId(angle: number): string {
  return `swing-line-${Math.floor(angle + 1e-9)}`;
}

interface SwingLike {
  shape: string;
  angle: number | null;
  name?: string | null;
  builtin?: number;
}

/**
 * What a swing is called on screen. The two starting lines, the circles, and "still" have fixed names; an added
 * line shows the name its person gave it, or its angle.
 */
export function swingName(swing: SwingLike): string {
  if (swing.shape === "circle_cw") return "Circle clockwise";
  if (swing.shape === "circle_ccw") return "Circle counter-clockwise";
  if (swing.shape === "still") return "Still";
  if (swing.builtin && swing.angle === 0) return "Back and forth";
  if (swing.builtin && swing.angle === 90) return "Side to side";
  return swing.name?.trim() || `Line at ${formatAngle(swing.angle ?? 0)}°`;
}

/** The movement in plain words, for a picture's text and for anyone who cannot see the picture. */
export function swingWords(swing: SwingLike): string {
  if (swing.shape === "circle_cw") return "Goes round in a circle, clockwise as seen from above.";
  if (swing.shape === "circle_ccw") return "Goes round in a circle, counter-clockwise as seen from above.";
  if (swing.shape === "still") return "Does not move.";
  const angle = swing.angle ?? 0;
  if (angle === 0) return "Swings along a line, straight up and down on the board.";
  if (angle === 90) return "Swings along a line, straight across the board.";
  return `Swings along a line at ${formatAngle(angle)}°, clockwise from straight up and down on the board.`;
}

/**
 * How the person's words for a swing differ now from when an answer was given. Only the facts: nothing says one
 * wording is better. Null when the words are the same.
 */
export function wordingChange(then: string | null, now: string | null): "added" | "cleared" | "changed" | null {
  const a = then?.trim() || null;
  const b = now?.trim() || null;
  if (a === b) return null;
  if (a === null) return "added";
  if (b === null) return "cleared";
  return "changed";
}
