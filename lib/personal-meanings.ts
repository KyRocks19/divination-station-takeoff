import { query, queryOne } from "./db";
import { getCardById, type TarotCard } from "./cards";

export interface MeaningFields {
  uprightKeywords: string | null;
  reversedKeywords: string | null;
  uprightDescription: string | null;
  reversedDescription: string | null;
}

export interface MeaningRow {
  upright_keywords: string | null;
  reversed_keywords: string | null;
  upright_description: string | null;
  reversed_description: string | null;
}

export function stockMeaning(card: TarotCard): MeaningFields {
  return {
    uprightKeywords: card.uprightMeaning,
    reversedKeywords: card.reversedMeaning,
    uprightDescription: card.uprightDescription,
    reversedDescription: card.reversedDescription,
  };
}

/**
 * Turn a stored row into the user's own meaning. Blank fields, and fields that are an unedited copy of
 * the built-in text (older saves stored all four fields at once), do not count as the user's words.
 */
export function toPersonalMeaning(card: TarotCard, row: MeaningRow | null): MeaningFields | null {
  if (!row) return null;
  const stock = stockMeaning(card);
  const own = (value: string | null, builtIn: string | null) => {
    const text = value?.trim();
    return text && text !== builtIn?.trim() ? text : null;
  };
  const personal: MeaningFields = {
    uprightKeywords: own(row.upright_keywords, stock.uprightKeywords),
    reversedKeywords: own(row.reversed_keywords, stock.reversedKeywords),
    uprightDescription: own(row.upright_description, stock.uprightDescription),
    reversedDescription: own(row.reversed_description, stock.reversedDescription),
  };
  return Object.values(personal).some(Boolean) ? personal : null;
}

export async function getPersonalMeaning(userId: number, cardId: string): Promise<MeaningFields | null> {
  const card = getCardById(cardId);
  if (!card) return null;
  const row = await queryOne<MeaningRow>(
    "SELECT upright_keywords, reversed_keywords, upright_description, reversed_description FROM card_customizations WHERE user_id = $1 AND card_id = $2",
    [userId, cardId]
  );
  return toPersonalMeaning(card, row);
}

/** The user's own meanings for a set of cards, keyed by card id. Cards they have not written about are absent. */
export async function loadPersonalMeanings(userId: number, cardIds: string[]): Promise<Record<string, MeaningFields>> {
  const ids = [...new Set(cardIds)].filter(Boolean);
  if (ids.length === 0) return {};
  const rows = await query<MeaningRow & { card_id: string }>(
    "SELECT card_id, upright_keywords, reversed_keywords, upright_description, reversed_description FROM card_customizations WHERE user_id = $1 AND card_id = ANY($2)",
    [userId, ids]
  );
  const result: Record<string, MeaningFields> = {};
  for (const row of rows) {
    const card = getCardById(row.card_id);
    const personal = card ? toPersonalMeaning(card, row) : null;
    if (personal) result[row.card_id] = personal;
  }
  return result;
}
