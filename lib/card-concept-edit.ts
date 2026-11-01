// Reading and changing which tarot cards the concepts sit on, for the "By card" board on /archetypes/review. Server
// code only: it imports the database. /api/archetypes/cards checks that the caller is an admin first (concepts and
// their card links are shared by every account). card_concepts.reversed = true is a concept on the reversed card.

import { query, withTransaction } from "@/lib/db";
import { TAROT_DECK, getCardById } from "@/lib/cards";
import type { CardMove } from "@/lib/card-concept-edit-core";

export interface BoardConcept {
  id: number;
  name: string;
  display_name: string;
  /** True when the concept sits on this card reversed. */
  reversed: boolean;
  /** How many cards the concept sits on, either way up. */
  cards: number;
  links: { slug: string; primary: boolean; aspect: string }[];
}

export interface CardBoard {
  card: { id: string; name: string };
  concepts: BoardConcept[];
  /** How many concepts each card holds, for the card column. */
  counts: Record<string, { upright: number; reversed: number }>;
}

export const isCard = (id: string) => getCardById(id) !== undefined;

/** One card's concepts, upright and reversed, with each concept's archetypes, and how full every card is. */
export async function cardBoard(cardId: string): Promise<CardBoard> {
  const [concepts, tallies] = await Promise.all([
    query<BoardConcept>(
      `SELECT c.id, c.name, c.display_name, cc.reversed,
              (SELECT COUNT(DISTINCT x.card_id) FROM card_concepts x WHERE x.concept_id = c.id)::int AS cards,
              COALESCE(
                (SELECT json_agg(json_build_object('slug', a.slug, 'primary', ca.is_primary, 'aspect', ca.aspect)
                                 ORDER BY ca.is_primary DESC, a.sort_order)
                   FROM concept_archetypes ca JOIN archetypes a ON a.id = ca.archetype_id
                  WHERE ca.concept_id = c.id),
                '[]'
              ) AS links
         FROM card_concepts cc
         JOIN concepts c ON c.id = cc.concept_id
        WHERE cc.card_id = $1
        ORDER BY cc.reversed, c.display_name`,
      [cardId]
    ),
    query<{ card_id: string; reversed: boolean; n: number }>(
      "SELECT card_id, reversed, COUNT(*)::int AS n FROM card_concepts GROUP BY card_id, reversed",
      []
    ),
  ]);
  const counts: CardBoard["counts"] = {};
  for (const c of TAROT_DECK) counts[c.id] = { upright: 0, reversed: 0 };
  for (const t of tallies) {
    if (!counts[t.card_id]) continue;
    counts[t.card_id][t.reversed ? "reversed" : "upright"] = Number(t.n);
  }
  return { card: { id: cardId, name: getCardById(cardId)?.name ?? cardId }, concepts, counts };
}

/**
 * Moves (or copies) some concepts from one card spot to another in one transaction. A concept that is not at `from`
 * is left alone, and one already at `to` is not doubled. Returns how many concepts were moved.
 */
export async function moveCardConcepts(m: CardMove): Promise<number> {
  const fromRev = m.from.orientation === "reversed";
  const toRev = m.to.orientation === "reversed";
  return withTransaction(async (db) => {
    const { rows } = await db.query(
      "SELECT concept_id FROM card_concepts WHERE card_id = $1 AND reversed = $2 AND concept_id = ANY($3::int[])",
      [m.from.card, fromRev, m.ids]
    );
    const ids = rows.map((r: { concept_id: number }) => r.concept_id);
    if (ids.length === 0) return 0;
    await db.query(
      `INSERT INTO card_concepts (card_id, concept_id, reversed)
       SELECT $1, x, $2 FROM unnest($3::int[]) AS x
       ON CONFLICT DO NOTHING`,
      [m.to.card, toRev, ids]
    );
    if (!m.copy) {
      await db.query("DELETE FROM card_concepts WHERE card_id = $1 AND reversed = $2 AND concept_id = ANY($3::int[])", [
        m.from.card,
        fromRev,
        ids,
      ]);
    }
    return ids.length;
  });
}
