import { NextRequest } from "next/server";
import { queryOne, withTransaction } from "@/lib/db";
import { getSession } from "@/lib/session";
import { cleanText, listCards, toId, FIRST_DECK_NAME } from "@/lib/oracle";
import { jsonBody } from "@/lib/own-http";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const deckId = toId(request.nextUrl.searchParams.get("deck_id"));
  if (!deckId) return Response.json({ error: "deck_id is required" }, { status: 400 });
  return Response.json(await listCards(session.userId, deckId));
}

// Only a name is needed. Without deck_id the card goes into the person's first deck, which is made here
// if they have no deck yet.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId;

  const body = await jsonBody(request);
  if (body instanceof Response) return body;
  const name = cleanText(body.name);
  if (!name) return Response.json({ error: "name is required" }, { status: 400 });

  let deckId: number;
  if (body.deck_id != null) {
    const deck = await queryOne<{ id: number }>(
      "SELECT id FROM oracle_decks WHERE id = $1 AND user_id = $2",
      [toId(body.deck_id), userId]
    );
    if (!deck) return Response.json({ error: "Deck not found" }, { status: 404 });
    deckId = deck.id;
  } else {
    const first = await queryOne<{ id: number }>(
      "SELECT id FROM oracle_decks WHERE user_id = $1 ORDER BY created_at ASC, id ASC LIMIT 1",
      [userId]
    );
    deckId = first?.id ?? 0;
  }

  if (deckId) {
    const inDeck = await queryOne<{ n: number }>("SELECT COUNT(*)::int AS n FROM oracle_cards WHERE deck_id = $1 AND user_id = $2", [deckId, userId]);
    if ((inDeck?.n ?? 0) >= 1000) return Response.json({ error: "A set holds at most 1,000 items for now." }, { status: 400 });
  }

  const card = await withTransaction(async (client) => {
    if (!deckId) {
      const { rows } = await client.query(
        "INSERT INTO oracle_decks (user_id, name) VALUES ($1, $2) RETURNING id",
        [userId, FIRST_DECK_NAME]
      );
      deckId = rows[0].id;
    }
    // A new card goes at the end of the deck's order.
    const { rows } = await client.query(
      `INSERT INTO oracle_cards (user_id, deck_id, name, origin, sort_order)
       VALUES ($1, $2, $3, $4, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM oracle_cards WHERE deck_id = $2))
       RETURNING id, deck_id, name, origin, resting, created_at, updated_at`,
      [userId, deckId, name, cleanText(body.origin)]
    );
    return rows[0];
  });

  return Response.json({ ...card, meaning_count: 0 }, { status: 201 });
}
