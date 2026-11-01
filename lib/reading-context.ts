import { TAROT_DECK } from "./cards";
import type { MeaningFields } from "./personal-meanings";
import { describeSky, readingSky } from "./sky";

export interface DrawnCard {
  position: string;
  card_id: string;
  card_name: string;
  reversed: boolean;
}

export type ClarifierMap = Record<number, DrawnCard[]>;

/** The user's own meanings, keyed by card id (see loadPersonalMeanings). */
export type PersonalMeanings = Record<string, MeaningFields>;

export interface JournalForContext {
  author: string;
  content: string;
  created_at: string | Date;
  kind?: string | null;
}

/**
 * Appended to every system prompt that receives reading context, so each AI voice treats the user's
 * own words as the meaning and the built-in text as background.
 */
export const SEEKER_FIRST = `The seeker's own words come first. Where a card is listed with "seeker's own meaning", that is what the card means in this reading. A "Pixie-Smith reference" is background only: never use it to correct, replace, or outrank what the seeker has written. Journal entries marked "Seeker" are theirs; entries under any other name were written by an AI voice and are not the seeker's view. Mirror the seeker's language. Never say or imply that a meaning is wrong or that they missed something.`;

function lookupMeaning(card_id: string, reversed: boolean): string {
  const data = TAROT_DECK.find((t) => t.id === card_id);
  if (!data) return "";
  return reversed ? data.reversedMeaning : data.uprightMeaning;
}

function ownMeaning(personal: PersonalMeanings | undefined, card_id: string, reversed: boolean): string {
  const p = personal?.[card_id];
  if (!p) return "";
  const parts = reversed
    ? [p.reversedKeywords, p.reversedDescription]
    : [p.uprightKeywords, p.uprightDescription];
  return parts.filter(Boolean).join(" — ");
}

/** The meaning lines that follow a card: the seeker's own first, the built-in text after it as reference. */
export function meaningLines(
  card: { card_id: string; reversed: boolean },
  personal: PersonalMeanings | undefined,
  indent: string
): string {
  const own = ownMeaning(personal, card.card_id, card.reversed);
  const stock = lookupMeaning(card.card_id, card.reversed);
  let lines = "";
  if (own) lines += `\n${indent}seeker's own meaning: "${own}"`;
  if (stock) lines += `\n${indent}Pixie-Smith reference: "${stock}"`;
  return lines;
}

export function journalAuthorLabel(author: string, kind?: string | null): string {
  if (author === "user") {
    if (kind === "impression") return "Seeker — first impression";
    if (kind === "lookback") return "Seeker — looking back, what happened afterwards";
    return "Seeker";
  }
  if (author === "hiero" || author === "claude") return "Hiero (AI)";
  if (author === "guide") return "Guide (AI)";
  if (author === "sword") return "Earlier AI entry";
  if (author === "interview") return "Interview (Hiero's questions, the seeker's answers, then Hiero (AI))";
  return author;
}

export function cardIdsOf(reading: { cards: string | DrawnCard[]; clarifiers?: string | ClarifierMap | null }): string[] {
  const cards: DrawnCard[] = typeof reading.cards === "string" ? JSON.parse(reading.cards) : reading.cards;
  const clarifiers: ClarifierMap = reading.clarifiers
    ? typeof reading.clarifiers === "string" ? JSON.parse(reading.clarifiers) : reading.clarifiers
    : {};
  return [...cards, ...Object.values(clarifiers).flat()].map((c) => c.card_id);
}

/**
 * Build a numbered list of all spread cards with any clarifiers nested beneath
 * each card. Used in single-reading interpret prompts.
 */
export function formatSpreadContext(cards: DrawnCard[], clarifiers: ClarifierMap, personal?: PersonalMeanings): string {
  return cards
    .map((c, i) => {
      const orientation = c.reversed ? "reversed" : "upright";
      let line = `  ${i + 1}. Position: ${c.position} — ${c.card_name} (${orientation})${meaningLines(c, personal, "       ")}`;
      const group = clarifiers[i];
      if (group?.length) {
        const cLines = group.map((cl) => {
          const co = cl.reversed ? "reversed" : "upright";
          return `       ↳ ${cl.position}: ${cl.card_name} (${co})${meaningLines(cl, personal, "           ")}`;
        });
        line += `\n${cLines.join("\n")}`;
      }
      return line;
    })
    .join("\n");
}

/**
 * Format a complete reading (spread + all clarifiers + journals) as a context
 * block suitable for multi-reading Claude prompts (synthesize, etc.).
 */
export function formatReadingForClaude(
  reading: {
    spread_name: string;
    title?: string | null;
    question?: string | null;
    cards: string | DrawnCard[];
    clarifiers?: string | ClarifierMap | null;
    created_at?: string;
    sky?: string | null;
  },
  journals: JournalForContext[] = [],
  personal?: PersonalMeanings
): string {
  const cards: DrawnCard[] =
    typeof reading.cards === "string" ? JSON.parse(reading.cards) : reading.cards;
  const clarifiers: ClarifierMap = reading.clarifiers
    ? typeof reading.clarifiers === "string"
      ? JSON.parse(reading.clarifiers)
      : reading.clarifiers
    : {};

  let block = `### Reading: ${reading.title || reading.spread_name}`;
  block += `\nSpread: ${reading.spread_name}`;
  if (reading.created_at) {
    block += `\nDate: ${new Date(reading.created_at).toLocaleDateString()}`;
    block += `\nSky: ${describeSky(readingSky({ sky: reading.sky, created_at: reading.created_at }))}`;
  }
  if (reading.question) block += `\nQuestion: ${reading.question}`;
  block += `\nCards:`;

  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    const orientation = c.reversed ? "reversed" : "upright";
    block += `\n  - ${c.position}: ${c.card_name} (${orientation})${meaningLines(c, personal, "      ")}`;

    const group = clarifiers[i];
    if (group?.length) {
      for (const cl of group) {
        const co = cl.reversed ? "reversed" : "upright";
        block += `\n      ↳ ${cl.position}: ${cl.card_name} (${co})${meaningLines(cl, personal, "          ")}`;
      }
    }
  }

  if (journals.length) {
    const journalLines = journals.map(
      (j) =>
        `  [${journalAuthorLabel(j.author, j.kind)}, ${new Date(j.created_at).toLocaleDateString()}]\n  ${j.content}`
    );
    block += `\nJournal entries:\n${journalLines.join("\n\n")}`;
  }

  return block;
}
