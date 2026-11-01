import { NextRequest } from "next/server";
import { query, queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";
import { idList, tooLong } from "@/lib/limits";
import { jsonBody } from "@/lib/own-http";

export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const entries = await query(
    "SELECT * FROM synthesis_journals WHERE user_id = $1 ORDER BY created_at DESC",
    [session.userId!]
  );
  return Response.json(entries);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const sent = await jsonBody(request);
  if (sent instanceof Response) return sent;
  const { prompt, content, reading_ids = [], journal_ids = [] } = sent;
  if (!prompt?.trim() || !content?.trim()) {
    return Response.json({ error: "prompt and content are required" }, { status: 400 });
  }
  if (typeof prompt !== "string" || typeof content !== "string" || tooLong(prompt, 4000) || tooLong(content, 40000)) {
    return Response.json({ error: "That entry is too long" }, { status: 400 });
  }
  const row = await queryOne<{ id: number }>(
    "INSERT INTO synthesis_journals (user_id, prompt, content, context_ids) VALUES ($1, $2, $3, $4) RETURNING id",
    [session.userId!, prompt, content, JSON.stringify({ reading_ids: idList(reading_ids, 50), journal_ids: idList(journal_ids, 50) })]
  );
  const entry = await queryOne("SELECT * FROM synthesis_journals WHERE id = $1", [row!.id]);
  return Response.json(entry, { status: 201 });
}
