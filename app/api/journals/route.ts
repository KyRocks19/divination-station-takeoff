import { NextRequest } from "next/server";
import { query, queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";
import { tooLong } from "@/lib/limits";
import { jsonBody } from "@/lib/own-http";

const KINDS = ["note", "impression", "lookback"];

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const readingId = url.searchParams.get("reading_id");
  const author = url.searchParams.get("author");

  let sql = "SELECT j.* FROM journals j JOIN readings r ON j.reading_id = r.id WHERE r.user_id = $1";
  const params: any[] = [session.userId!];
  if (readingId) { sql += ` AND j.reading_id = $${params.push(readingId)}`; }
  if (author) { sql += ` AND j.author = $${params.push(author)}`; }
  sql += " ORDER BY j.created_at DESC";

  return Response.json(await query(sql, params));
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const sent = await jsonBody(request);
  if (sent instanceof Response) return sent;
  const { reading_id, author, content, card_index, clarifier_index, kind = "note" } = sent;
  if (!reading_id || !author || !content) {
    return Response.json({ error: "reading_id, author, and content are required" }, { status: 400 });
  }
  if (!["user", "claude", "hiero", "guide"].includes(author)) {
    return Response.json({ error: "author must be 'user', 'claude', 'hiero', or 'guide'" }, { status: 400 });
  }
  if (typeof content !== "string" || tooLong(content, 20000)) {
    return Response.json({ error: "That entry is too long (20,000 characters)" }, { status: 400 });
  }
  if (!KINDS.includes(kind)) {
    return Response.json({ error: "kind must be 'note', 'impression', or 'lookback'" }, { status: 400 });
  }
  // First impressions and look-backs are the user's own words by definition.
  if (kind !== "note" && author !== "user") {
    return Response.json({ error: `a ${kind} entry must have author 'user'` }, { status: 400 });
  }

  const reading = await queryOne<{ id: number; cards: string; clarifiers: string | null }>(
    "SELECT id, cards, clarifiers FROM readings WHERE id = $1 AND user_id = $2",
    [reading_id, session.userId!]
  );
  if (!reading) return Response.json({ error: "Reading not found" }, { status: 404 });

  // Entries about one card record which card, so the user's words about it can be found across readings.
  let cardId: string | null = null;
  if (card_index != null) {
    const spreadCard = JSON.parse(reading.cards)[card_index];
    const clarifier = clarifier_index != null && reading.clarifiers
      ? JSON.parse(reading.clarifiers)[card_index]?.[clarifier_index]
      : null;
    cardId = (clarifier_index != null ? clarifier : spreadCard)?.card_id ?? null;
  }
  if (kind === "impression" && !cardId) {
    return Response.json({ error: "an impression needs a valid card_index" }, { status: 400 });
  }

  const row = await queryOne<{ id: number }>(
    "INSERT INTO journals (reading_id, author, content, card_index, clarifier_index, kind, card_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
    [reading_id, author, content, card_index ?? null, clarifier_index ?? null, kind, cardId]
  );
  const journal = await queryOne("SELECT * FROM journals WHERE id = $1", [row!.id]);
  return Response.json(journal, { status: 201 });
}
