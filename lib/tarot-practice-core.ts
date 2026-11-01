// Tarot practice with a sealed card (release plan §6 idea 4, owner decision 2026-10-22): the app draws one card and keeps it hidden; the person
// says which suit they sense (and, if they like, writes words); then the card is shown. Kept as the person's own record with the arithmetic of
// chance beside it. Like blind-target practice, it makes no claim either way about whether anyone can do better than chance.
// Pure: no database and no deck, so the page in the browser and the tests can use it.

export const PRACTICE_SUITS = ["major", "wands", "cups", "swords", "pentacles"] as const;
export type PracticeSuit = (typeof PRACTICE_SUITS)[number];

export const PRACTICE_SUIT_LABELS: Record<PracticeSuit, string> = {
  major: "Major arcana",
  wands: "Wands",
  cups: "Cups",
  swords: "Swords",
  pentacles: "Pentacles",
};

/** How many of the 78 cards are in each group: 22 major arcana, 14 in each suit. */
export const SUIT_SIZES: Record<PracticeSuit, number> = { major: 22, wands: 14, cups: 14, swords: 14, pentacles: 14 };
export const DECK_SIZE = 78;

export const MAX_PRACTICE_WORDS = 1000;

export function isPracticeSuit(value: unknown): value is PracticeSuit {
  return typeof value === "string" && (PRACTICE_SUITS as readonly string[]).includes(value);
}

/** The chance of naming the right group by guessing alone: 22/78 for the major arcana, 14/78 for a suit. */
export function chanceOf(suit: PracticeSuit): number {
  return SUIT_SIZES[suit] / DECK_SIZE;
}

/** The suit of a card id ("major-0", "cups-10"). Null for anything else. */
export function suitOfCard(cardId: string): PracticeSuit | null {
  const suit = cardId.split("-")[0];
  return isPracticeSuit(suit) ? suit : null;
}

export interface PracticeSummary {
  trials: number;
  hits: number;
  /** How many right guesses chance alone would give on average, for the suits the person actually named. One decimal. */
  expected: number;
}

/** The person's guessed trials as plain numbers: how many, how many named the right group, and the chance figure for the same guesses. */
export function summarize(trials: { guess_suit: PracticeSuit | null; card_id: string }[]): PracticeSummary {
  let hits = 0;
  let expected = 0;
  let count = 0;
  for (const t of trials) {
    if (!t.guess_suit) continue;
    count += 1;
    if (suitOfCard(t.card_id) === t.guess_suit) hits += 1;
    expected += chanceOf(t.guess_suit);
  }
  return { trials: count, hits, expected: Math.round(expected * 10) / 10 };
}
