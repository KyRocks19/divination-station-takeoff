import { NextRequest } from "next/server";
import { query, queryOne } from "@/lib/db";
import { getClaudeApiUserId } from "@/lib/claude-api";
import { jsonBody } from "@/lib/own-http";

export async function POST(request: NextRequest) {
  const userId = await getClaudeApiUserId(request);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const sent = await jsonBody(request);
  if (sent instanceof Response) return sent;
  const { reading_id, content } = sent;
  if (!reading_id || !content) {
    return Response.json({ error: "reading_id and content are required" }, { status: 400 });
  }

  const reading = await queryOne(
    "SELECT id FROM readings WHERE id = $1 AND user_id = $2",
    [reading_id, userId]
  );
  if (!reading) return Response.json({ error: "Reading not found" }, { status: 404 });

  const row = await queryOne<{ id: number }>(
    "INSERT INTO journals (reading_id, author, content) VALUES ($1, 'claude', $2) RETURNING id",
    [reading_id, content]
  );
  const journal = await queryOne("SELECT * FROM journals WHERE id = $1", [row!.id]);
  return Response.json(journal, { status: 201 });
}

export async function GET(request: NextRequest) {
  const userId = await getClaudeApiUserId(request);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const journals = await query(`
    SELECT j.*, r.spread_name, r.title, r.question, r.cards, r.created_at as reading_date
    FROM journals j
    JOIN readings r ON r.id = j.reading_id
    WHERE j.author = 'claude' AND r.user_id = $1
    ORDER BY j.created_at DESC
  `, [userId]) as any[];
  return Response.json(journals.map((j) => ({ ...j, cards: JSON.parse(j.cards) })));
}
