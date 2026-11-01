import type { DivinationKind } from "./divination-kinds";

// The gentle nudges at the top of today's page, as plain data: no database code, so the screen that draws them and the
// tests can import it. lib/nudges.ts reads and dismisses them.

/**
 * A prediction whose date has come, a reading at least a week old with no look-back entry yet, or a "what you sensed first"
 * note at least a day old with no answer yet on how well it fitted (GF1 d; dismissing one needs migration 091).
 */
export type NudgeKind = "prediction" | "lookback" | "guess";

export const NUDGE_KINDS: NudgeKind[] = ["prediction", "lookback", "guess"];

/** How long after a guess is sealed before it is suggested for a "how well did it fit" answer. */
export const GUESS_NUDGE_AFTER_HOURS = 24;

/** How many of each kind are shown at once. */
export const NUDGES_PER_KIND = 3;

export interface Nudge {
  kind: NudgeKind;
  /** The prediction's id, or the reading's shared record id (`divinations.id`) for a look-back or a guess. */
  id: number;
  /** Where the nudge leads: the reading the prediction or look-back belongs to. */
  href: string;
  /** The person's own words (the prediction or the guess), or the reading's title. */
  text: string;
  /** The tool's name, and for a look-back the question asked. */
  detail: string;
  tool: DivinationKind;
  /** The line above the nudge when it is not the kind's usual one (a look-back the person asked to be reminded of). */
  lead?: string;
}

/** A dismissal sent by the page, checked: a known kind and a positive whole id. Null when it is not one. */
export function parseDismissal(body: unknown): { kind: NudgeKind; id: number } | null {
  if (!body || typeof body !== "object") return null;
  const { kind, id } = body as { kind?: unknown; id?: unknown };
  if (typeof kind !== "string" || !NUDGE_KINDS.includes(kind as NudgeKind)) return null;
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) return null;
  return { kind: kind as NudgeKind, id };
}

/** What the page says after a nudge is dismissed, so the person knows it is not lost. */
export function dismissedMessage(kind: NudgeKind): string {
  if (kind === "prediction") return "Dismissed. The prediction is still on the Predictions page.";
  if (kind === "guess") return "Dismissed. What you sensed is still on the reading and on the Predictions page.";
  return "Dismissed. The reading is still in your Readings.";
}
