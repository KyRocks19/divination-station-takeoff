import { TAROT_DECK, type Suit, type TarotCard } from "./cards";
import { getCardAssociations, type Element } from "./card-associations";

export type CardKind = "major" | "ace" | "pip" | "court";

export interface CardStructure {
  kind: CardKind;
  suit: Suit;
  suitLabel: string;
  /** Second half of the card id: "ace", "2"…"10", "page"…"king", or the major's number. */
  rank: string;
  /** What to show large: "5", "Ace", "Queen", "16". */
  rankLabel: string;
  /** Plural used when grouping: "Fives", "Aces", "Queens". Empty for majors. */
  rankPlural: string;
}

export const SUIT_LABEL: Record<Suit, string> = {
  major: "Major Arcana",
  cups: "Cups",
  pentacles: "Pentacles",
  swords: "Swords",
  wands: "Wands",
};

export const RANK_PLURAL: Record<string, string> = {
  ace: "Aces", "2": "Twos", "3": "Threes", "4": "Fours", "5": "Fives", "6": "Sixes", "7": "Sevens",
  "8": "Eights", "9": "Nines", "10": "Tens", page: "Pages", knight: "Knights", queen: "Queens", king: "Kings",
};

const COURT = ["page", "knight", "queen", "king"];

export function getCardStructure(cardId: string): CardStructure | null {
  const dash = cardId.indexOf("-");
  if (dash < 0) return null;
  const suit = cardId.slice(0, dash) as Suit;
  const rank = cardId.slice(dash + 1);
  if (!(suit in SUIT_LABEL)) return null;

  if (suit === "major") {
    return { kind: "major", suit, suitLabel: SUIT_LABEL.major, rank, rankLabel: rank, rankPlural: "" };
  }
  const kind: CardKind = rank === "ace" ? "ace" : COURT.includes(rank) ? "court" : "pip";
  const rankLabel = kind === "pip" ? rank : rank.charAt(0).toUpperCase() + rank.slice(1);
  return { kind, suit, suitLabel: SUIT_LABEL[suit], rank, rankLabel, rankPlural: RANK_PLURAL[rank] ?? "" };
}

/** The other minor cards that share this card's rank (the other three Fives, and so on). */
export function cardsSharingRank(cardId: string): TarotCard[] {
  const s = getCardStructure(cardId);
  if (!s || s.kind === "major") return [];
  return TAROT_DECK.filter((c) => c.id !== cardId && c.suit !== "major" && c.id.endsWith(`-${s.rank}`));
}

// ─── Elements ─────────────────────────────────────────────────────────────────
// Each element is a pair of qualities; two elements relate by the qualities they share.
export const ELEMENT_QUALITIES: Record<Element, { temperature: "Hot" | "Cold"; moisture: "Dry" | "Wet" }> = {
  Fire:  { temperature: "Hot",  moisture: "Dry" },
  Earth: { temperature: "Cold", moisture: "Dry" },
  Air:   { temperature: "Hot",  moisture: "Wet" },
  Water: { temperature: "Cold", moisture: "Wet" },
};

export type ElementRelation = "same" | "shared" | "opposite";

export function relateElements(a: Element, b: Element): { relation: ElementRelation; text: string } {
  if (a === b) return { relation: "same", text: `both ${a}` };
  const qa = ELEMENT_QUALITIES[a];
  const qb = ELEMENT_QUALITIES[b];
  if (qa.temperature === qb.temperature) return { relation: "shared", text: `both ${qa.temperature.toLowerCase()}` };
  if (qa.moisture === qb.moisture) return { relation: "shared", text: `both ${qa.moisture.toLowerCase()}` };
  return { relation: "opposite", text: "no shared quality" };
}

export function elementOf(cardId: string): Element | undefined {
  return getCardAssociations(cardId).element;
}
