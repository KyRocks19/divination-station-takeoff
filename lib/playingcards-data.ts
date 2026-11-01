// The standard 52-card pack of playing cards (four suits of thirteen). This file touches no database code, so screens that run in the browser can import it.
//
// It carries only what the pack fixes and anyone can check: the suits, the ranks and the names. The app gives NO meaning for any card. Many written systems
// of card meanings exist and they disagree, and none has been read and checked for this app yet (see the playing-card page on /sources), so what each card
// means is the person's own to write.

export type Suit = "S" | "H" | "D" | "C";

export interface SuitInfo {
  id: Suit;
  name: string;
  /** The suit's mark, drawn as a plain symbol. */
  symbol: string;
  red: boolean;
}

export const SUITS: SuitInfo[] = [
  { id: "S", name: "Spades", symbol: "♠", red: false },
  { id: "H", name: "Hearts", symbol: "♥", red: true },
  { id: "D", name: "Diamonds", symbol: "♦", red: true },
  { id: "C", name: "Clubs", symbol: "♣", red: false },
];

export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;
export type Rank = (typeof RANKS)[number];

const RANK_NAMES: Record<Rank, string> = {
  A: "Ace", "2": "Two", "3": "Three", "4": "Four", "5": "Five", "6": "Six", "7": "Seven", "8": "Eight", "9": "Nine", "10": "Ten", J: "Jack", Q: "Queen", K: "King",
};

export interface PlayingCard {
  /** For example 'H-7'. */
  id: string;
  suit: Suit;
  rank: Rank;
  /** For example "Seven of Hearts". */
  name: string;
  /** The id the person's own meaning is kept under (card_customizations). */
  meaningId: string;
}

export const PLAYING_CARDS: PlayingCard[] = SUITS.flatMap((s) =>
  RANKS.map((r) => ({ id: `${s.id}-${r}`, suit: s.id, rank: r, name: `${RANK_NAMES[r]} of ${s.name}`, meaningId: `playing-${s.id}-${r}` }))
);

const BY_ID = new Map(PLAYING_CARDS.map((c) => [c.id, c]));

export function getCard(id: unknown): PlayingCard | null {
  return typeof id === "string" ? BY_ID.get(id) ?? null : null;
}

/** The card for a meaning id such as 'playing-H-7', or null. */
export function cardOfMeaningId(meaningId: unknown): PlayingCard | null {
  return typeof meaningId === "string" && meaningId.startsWith("playing-") ? getCard(meaningId.slice(8)) : null;
}

export function suitOf(card: PlayingCard): SuitInfo {
  return SUITS.find((s) => s.id === card.suit)!;
}

export const MAX_DRAW = 10;

/** A whole number from 1 to MAX_DRAW, or null. */
export function cleanDrawCount(value: unknown): number | null {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= MAX_DRAW ? n : null;
}

/** `count` different cards from the pack, each pick equally likely (a partial shuffle), using the random method the person chose in Settings. */
export function drawCards(count: number, rng: () => number): PlayingCard[] {
  const pack = [...PLAYING_CARDS];
  const out: PlayingCard[] = [];
  for (let i = 0; i < count && pack.length > 0; i++) {
    const j = Math.min(pack.length - 1, Math.floor(rng() * pack.length));
    out.push(pack.splice(j, 1)[0]);
  }
  return out;
}

export function drawSummary(cards: { card_name: string }[]): string {
  return cards.map((c) => c.card_name).join(", ");
}

export const PLAYING_CARD_WORDS = {
  here: "The pack has 52 cards in four suits. This app gives no meaning for any card: what each one means is yours to write, and every version of your words is kept.",
};
