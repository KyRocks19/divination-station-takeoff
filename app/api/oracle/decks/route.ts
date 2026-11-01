import { NextRequest } from "next/server";
import { queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";
import { cleanText, listDecks } from "@/lib/oracle";
import { cleanForm } from "@/lib/oracle-forms";
import { jsonBody } from "@/lib/own-http";

export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await listDecks(session.userId));
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await jsonBody(request);
  if (body instanceof Response) return body;
  const name = cleanText(body.name);
  if (!name) return Response.json({ error: "name is required" }, { status: 400 });

  const form = body.form === undefined ? "cards" : cleanForm(body.form);
  if (!form) return Response.json({ error: "form must be cards, stones, staves, or charms" }, { status: 400 });

  const owned = await queryOne<{ n: number }>("SELECT COUNT(*)::int AS n FROM oracle_decks WHERE user_id = $1", [session.userId]);
  if ((owned?.n ?? 0) >= 60) return Response.json({ error: "You have 60 sets, which is the most for now. Delete one to make another." }, { status: 400 });

  const deck = await queryOne(
    `INSERT INTO oracle_decks (user_id, name, description, form) VALUES ($1, $2, $3, $4)
     RETURNING id, name, description, reversals, reversal_chance, form, created_at, updated_at`,
    [session.userId, name, cleanText(body.description), form]
  );
  return Response.json({ ...deck, card_count: 0 }, { status: 201 });
}
