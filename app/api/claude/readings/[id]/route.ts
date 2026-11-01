import { NextRequest } from "next/server";
import { query, queryOne } from "@/lib/db";
import { getClaudeApiUserId } from "@/lib/claude-api";
import { idParam } from "@/lib/own-http";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/claude/readings/[id]">) {
  const userId = await getClaudeApiUserId(request);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const reading = await queryOne(
    "SELECT * FROM readings WHERE id = $1 AND user_id = $2",
    [id, userId]
  ) as any;
  if (!reading) return Response.json({ error: "Not found" }, { status: 404 });
  const journals = await query(
    "SELECT * FROM journals WHERE reading_id = $1 ORDER BY created_at ASC",
    [id]
  );
  return Response.json({ ...reading, cards: JSON.parse(reading.cards), journals });
}
