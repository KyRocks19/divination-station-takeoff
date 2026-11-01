import { NextRequest } from "next/server";
import { query, queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";
import { deleteArt } from "@/lib/art-store";
import { cleanText, toId } from "@/lib/oracle";
import { cleanForm, type SetForm } from "@/lib/oracle-forms";
import { idParam, jsonBody } from "@/lib/own-http";

// A field left out of the body is unchanged. An empty description clears it; the name cannot be emptied.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const deck = await queryOne<{ name: string; description: string | null; reversals: number; reversal_chance: number; form: SetForm }>(
    "SELECT name, description, reversals, reversal_chance, form FROM oracle_decks WHERE id = $1 AND user_id = $2",
    [toId(id), session.userId]
  );
  if (!deck) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await jsonBody(request);
  if (body instanceof Response) return body;
  const name = body.name === undefined ? deck.name : cleanText(body.name);
  if (!name) return Response.json({ error: "name is required" }, { status: 400 });
  const description = body.description === undefined ? deck.description : cleanText(body.description);
  const reversals = body.reversals === undefined ? deck.reversals : body.reversals ? 1 : 0;
  const chance = body.reversal_chance === undefined ? deck.reversal_chance : Number(body.reversal_chance);
  if (!Number.isInteger(chance) || chance < 0 || chance > 100) {
    return Response.json({ error: "reversal_chance must be a whole number from 0 to 100" }, { status: 400 });
  }

  const form = body.form === undefined ? deck.form : cleanForm(body.form);
  if (!form) return Response.json({ error: "form must be cards, stones, staves, or charms" }, { status: 400 });

  const updated = await queryOne(
    `UPDATE oracle_decks SET name = $1, description = $2, reversals = $3, reversal_chance = $4, form = $5, updated_at = NOW()
     WHERE id = $6 AND user_id = $7
     RETURNING id, name, description, reversals, reversal_chance, form, created_at, updated_at`,
    [name, description, reversals, chance, form, toId(id), session.userId]
  );
  return Response.json(updated);
}

// Deletes the deck and every card in it, with everything written on those cards. Past pulls from the deck
// stay in the person's history, with the names as they were.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const files = await query<{ file_key: string }>(
    `SELECT a.file_key FROM oracle_card_art a JOIN oracle_cards c ON c.id = a.card_id
     WHERE c.deck_id = $1 AND a.user_id = $2 AND a.file_key IS NOT NULL`,
    [toId(id), session.userId]
  );
  const deleted = await query(
    "DELETE FROM oracle_decks WHERE id = $1 AND user_id = $2 RETURNING id",
    [toId(id), session.userId]
  );
  if (deleted.length === 0) return Response.json({ error: "Not found" }, { status: 404 });
  await deleteArt(files.map((f) => f.file_key), session.userId);
  return new Response(null, { status: 204 });
}
