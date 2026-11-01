import { NextRequest } from "next/server";
import { queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";
import { cleanText, toId } from "@/lib/oracle";
import { idParam, jsonBody } from "@/lib/own-http";

// Adds a meaning to a card. A card can hold several, each with an optional label.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const card = await queryOne<{ id: number }>(
    "SELECT id FROM oracle_cards WHERE id = $1 AND user_id = $2",
    [toId(id), session.userId]
  );
  if (!card) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await jsonBody(request);
  if (body instanceof Response) return body;
  const content = cleanText(body.content);
  if (!content) return Response.json({ error: "content is required" }, { status: 400 });
  if (content.length > 20000) return Response.json({ error: "That meaning is too long (20,000 characters)" }, { status: 400 });
  const have = await queryOne<{ n: number }>("SELECT COUNT(*)::int AS n FROM oracle_card_meanings WHERE card_id = $1 AND user_id = $2", [card.id, session.userId]);
  if ((have?.n ?? 0) >= 100) return Response.json({ error: "An item holds at most 100 meanings for now." }, { status: 400 });

  // `reversed` marks a meaning for when the card lands upside down.
  const meaning = await queryOne(
    `INSERT INTO oracle_card_meanings (user_id, card_id, label, content, reversed, sort_order)
     VALUES ($1, $2, $3, $4, $5, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM oracle_card_meanings WHERE card_id = $2))
     RETURNING id, label, content, reversed, created_at, updated_at`,
    [session.userId, card.id, cleanText(body.label), content, body.reversed ? 1 : 0]
  );
  return Response.json({ ...meaning, earlier: [] }, { status: 201 });
}
