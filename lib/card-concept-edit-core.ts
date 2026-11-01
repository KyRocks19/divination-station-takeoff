// The words and the checks for moving tarot concepts between cards on /archetypes/review. Pure; no imports, so the
// browser, the route and the tests share it. A concept on a card reversed is card_concepts.reversed = true.

/** Which way up a card (or any piece that can turn over) is. Stored as `reversed` true or false. */
export type Orientation = "upright" | "reversed";

export const ORIENTATIONS: Orientation[] = ["upright", "reversed"];

export const ORIENTATION_LABELS: Record<Orientation, string> = {
  upright: "Upright",
  reversed: "Reversed",
};

export const orientationOf = (reversed: boolean): Orientation => (reversed ? "reversed" : "upright");

/** One place a concept sits: a card, upright or reversed. */
export interface CardSpot {
  card: string;
  orientation: Orientation;
}

/** One move or copy of some concepts from one spot to another, as the browser sends it. */
export interface CardMove {
  ids: number[];
  from: CardSpot;
  to: CardSpot;
  /** Copy keeps the concepts where they were as well. */
  copy: boolean;
}

const CARD_ID = /^[a-z]+-[a-z0-9]+$/;

function spot(raw: unknown, isCard: (id: string) => boolean): CardSpot | null {
  if (!raw || typeof raw !== "object") return null;
  const { card, orientation } = raw as Record<string, unknown>;
  if (typeof card !== "string" || !CARD_ID.test(card) || !isCard(card)) return null;
  if (orientation !== "upright" && orientation !== "reversed") return null;
  return { card, orientation };
}

/** Checks a move from the browser. `isCard` says whether an id is one of the 78 cards. */
export function cleanCardMove(
  body: unknown,
  isCard: (id: string) => boolean
): { ok: true; move: CardMove } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Nothing to move" };
  const b = body as Record<string, unknown>;
  const ids = Array.isArray(b.ids) ? [...new Set(b.ids.filter((n): n is number => Number.isInteger(n) && (n as number) > 0))] : [];
  if (ids.length === 0 || ids.length > 200) return { ok: false, error: "Choose 1 to 200 concepts" };
  const from = spot(b.from, isCard);
  const to = spot(b.to, isCard);
  if (!from || !to) return { ok: false, error: "Unknown card" };
  if (from.card === to.card && from.orientation === to.orientation) return { ok: false, error: "That is where they already are" };
  return { ok: true, move: { ids, from, to, copy: b.copy === true } };
}

/** The words for a spot, for example "The Tower, reversed". */
export function spotLabel(name: string, orientation: Orientation): string {
  return orientation === "reversed" ? `${name}, reversed` : `${name}, upright`;
}
