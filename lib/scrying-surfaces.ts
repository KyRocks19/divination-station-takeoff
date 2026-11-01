// The surfaces a person can look into, and the words for a session's length. This file touches no database
// code, so screens that run in the browser can import it. lib/scrying.ts re-exports everything here.

/** Every surface, in the order the picker shows them. A surface is added here when it is drawn. */
export const SCRYING_SURFACES = ["mirror", "ball", "water"] as const;
export type ScryingSurface = (typeof SCRYING_SURFACES)[number];

/** What each surface is called on screen. */
export const SCRYING_SURFACE_LABELS: Record<ScryingSurface, string> = {
  mirror: "Dark mirror",
  ball: "Crystal ball",
  water: "Bowl of water",
};

export function isScryingSurface(value: unknown): value is ScryingSurface {
  return typeof value === "string" && (SCRYING_SURFACES as readonly string[]).includes(value);
}

/** The name of a saved surface. A surface the app no longer has keeps a plain name. */
export function surfaceLabel(surface: string): string {
  return isScryingSurface(surface) ? SCRYING_SURFACE_LABELS[surface] : "Surface";
}

/** The longest time that is kept for one session: a whole day. */
export const MAX_SCRYING_MINUTES = 1440;

/** A whole number of minutes from 0 to a day, or null when the value is anything else. */
export function cleanMinutes(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_SCRYING_MINUTES
    ? value
    : null;
}

/**
 * Reads minutes a person typed: whole numbers only, from `min` up to a day. Anything else (empty, a decimal,
 * a sign, letters, too big) gives null, so the caller can say what is wrong or treat an empty box as "off".
 */
export function parseMinutesText(text: string, min = 0): number | null {
  const t = text.trim();
  if (!/^\d{1,4}$/.test(t)) return null;
  const n = Number(t);
  return n >= min && n <= MAX_SCRYING_MINUTES ? n : null;
}

/** How long a session lasted, in plain words: "less than a minute", "about 1 minute", "about 12 minutes". */
export function minutesInWords(minutes: number): string {
  if (minutes < 1) return "less than a minute";
  return `about ${minutes} minute${minutes !== 1 ? "s" : ""}`;
}
