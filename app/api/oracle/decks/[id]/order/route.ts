import { NextRequest } from "next/server";
import { query, queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";
import { toId } from "@/lib/oracle";
import { idParam, jsonBody } from "@/lib/own-http";

// Saves the person's own order for the cards in a deck. `card_ids` must list every card in the deck exactly once.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const deckId = toId(id);

  const body = await jsonBody(request);
  if (body instanceof Response) return body;
  if (!Array.isArray(body.card_ids)) return Response.json({ error: "card_ids must be a list" }, { status: 400 });
  const cardIds: number[] = body.card_ids.map(toId);

  const deck = await queryOne<{ id: number }>(
    "SELECT id FROM oracle_decks WHERE id = $1 AND user_id = $2",
    [deckId, session.userId]
  );
  if (!deck) return Response.json({ error: "Not found" }, { status: 404 });

  const current = await query<{ id: number }>(
    "SELECT id FROM oracle_cards WHERE deck_id = $1 AND user_id = $2",
    [deckId, session.userId]
  );
  const inDeck = new Set(current.map((c) => c.id));
  const sameCards =
    cardIds.length === inDeck.size && new Set(cardIds).size === cardIds.length && cardIds.every((c) => inDeck.has(c));
  if (!sameCards) {
    // A card was added or deleted somewhere else since the list was loaded.
    return Response.json({ error: "The cards in this deck have changed" }, { status: 409 });
  }

  await query(
    `UPDATE oracle_cards c SET sort_order = o.ord - 1
     FROM unnest($1::int[]) WITH ORDINALITY AS o(id, ord)
     WHERE c.id = o.id AND c.deck_id = $2 AND c.user_id = $3`,
    [cardIds, deckId, session.userId]
  );
  return Response.json({ ok: true });
}
