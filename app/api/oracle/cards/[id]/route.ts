import { NextRequest } from "next/server";
import { query, queryOne, withTransaction } from "@/lib/db";
import { getSession } from "@/lib/session";
import { deleteArt } from "@/lib/art-store";
import { cleanText, loadCard, toId } from "@/lib/oracle";
import { idParam, jsonBody } from "@/lib/own-http";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const card = await loadCard(session.userId, toId(id));
  if (!card) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(card);
}

// A field left out of the body is unchanged. An empty origin clears it; the name cannot be emptied.
// `fields`, when sent, replaces the whole list of the person's own named fields. `resting` rests or wakes the card.
// `deck_id`, when sent, moves the card to another of the person's own sets, to the end of its order. Everything
// written on the card, its picture and its earlier pulls come with it; the set's form only changes the words used.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId;
  const cardId = toId(id);

  const card = await queryOne<{ name: string; origin: string | null; resting: number; deck_id: number }>(
    "SELECT name, origin, resting, deck_id FROM oracle_cards WHERE id = $1 AND user_id = $2",
    [cardId, userId]
  );
  if (!card) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await jsonBody(request);
  if (body instanceof Response) return body;

  let moveTo: number | null = null;
  if (body.deck_id !== undefined) {
    const target = await queryOne<{ id: number }>("SELECT id FROM oracle_decks WHERE id = $1 AND user_id = $2", [
      toId(body.deck_id),
      userId,
    ]);
    if (!target) return Response.json({ error: "That set was not found" }, { status: 404 });
    if (target.id !== card.deck_id) moveTo = target.id;
  }
  const name = body.name === undefined ? card.name : cleanText(body.name);
  if (!name) return Response.json({ error: "name is required" }, { status: 400 });
  const origin = body.origin === undefined ? card.origin : cleanText(body.origin);
  // A resting card stays in the deck but is left out of pulls.
  const resting = body.resting === undefined ? card.resting : body.resting ? 1 : 0;

  let fields: { name: string; value: string | null }[] | null = null;
  if (body.fields !== undefined) {
    if (!Array.isArray(body.fields)) return Response.json({ error: "fields must be a list" }, { status: 400 });
    fields = [];
    for (const f of body.fields) {
      const fieldName = cleanText(f?.name);
      const value = cleanText(f?.value);
      if (!fieldName && !value) continue; // an empty row is not a field
      if (!fieldName) return Response.json({ error: "each field needs a name" }, { status: 400 });
      fields.push({ name: fieldName, value });
    }
  }

  await withTransaction(async (client) => {
    await client.query(
      "UPDATE oracle_cards SET name = $1, origin = $2, resting = $3, updated_at = NOW() WHERE id = $4 AND user_id = $5",
      [name, origin, resting, cardId, userId]
    );
    if (moveTo !== null) {
      // To the end of the new set: after every item that has been put in an order there.
      await client.query(
        `UPDATE oracle_cards SET deck_id = $1,
                sort_order = (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM oracle_cards WHERE deck_id = $1 AND user_id = $3)
         WHERE id = $2 AND user_id = $3`,
        [moveTo, cardId, userId]
      );
    }
    if (fields) {
      await client.query("DELETE FROM oracle_card_fields WHERE card_id = $1 AND user_id = $2", [cardId, userId]);
      for (const [i, f] of fields.entries()) {
        await client.query(
          "INSERT INTO oracle_card_fields (user_id, card_id, name, value, sort_order) VALUES ($1, $2, $3, $4, $5)",
          [userId, cardId, f.name, f.value, i]
        );
      }
    }
  });

  return Response.json(await loadCard(userId, cardId));
}

// Deletes the card with its meanings, their earlier versions, and its own fields.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // The picture's file (if it is kept on disk) goes with the card; the row itself goes by the database's cascade.
  const files = await query<{ file_key: string }>(
    "SELECT file_key FROM oracle_card_art WHERE card_id = $1 AND user_id = $2 AND file_key IS NOT NULL",
    [toId(id), session.userId]
  );
  const deleted = await query(
    "DELETE FROM oracle_cards WHERE id = $1 AND user_id = $2 RETURNING id",
    [toId(id), session.userId]
  );
  if (deleted.length === 0) return Response.json({ error: "Not found" }, { status: 404 });
  await deleteArt(files.map((f) => f.file_key), session.userId);
  return new Response(null, { status: 204 });
}
