import { NextRequest } from "next/server";
import { query, queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";
import { TAROT_DECK } from "@/lib/cards";
import { jsonBody } from "@/lib/own-http";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!TAROT_DECK.find((c) => c.id === id)) return Response.json({ error: "Not found" }, { status: 404 });
  const tags = await query(
    "SELECT t.* FROM tags t JOIN card_tags ct ON ct.tag_id = t.id WHERE ct.card_id = $1 AND ct.user_id = $2 ORDER BY t.name ASC",
    [id, session.userId]
  );
  return Response.json(tags);
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!TAROT_DECK.find((c) => c.id === id)) return Response.json({ error: "Not found" }, { status: 404 });

  const sent = await jsonBody(req);
  if (sent instanceof Response) return sent;
  const { tag_id, name, color } = sent;
  let resolvedTagId = tag_id;

  if (!resolvedTagId) {
    if (!name?.trim()) return Response.json({ error: "tag_id or name required" }, { status: 400 });
    const tag = await queryOne<{ id: number }>(
      "INSERT INTO tags (user_id, name, color) VALUES ($1, $2, $3) ON CONFLICT (user_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id",
      [session.userId, name.trim(), color ?? "#7c3aed"]
    );
    resolvedTagId = tag!.id;
  } else {
    const tag = await queryOne("SELECT id FROM tags WHERE id = $1 AND user_id = $2", [tag_id, session.userId]);
    if (!tag) return Response.json({ error: "Tag not found" }, { status: 404 });
  }

  await query(
    "INSERT INTO card_tags (card_id, user_id, tag_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
    [id, session.userId, resolvedTagId]
  );
  const tag = await queryOne("SELECT * FROM tags WHERE id = $1", [resolvedTagId]);
  return Response.json(tag, { status: 201 });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const sent = await jsonBody(req);
  if (sent instanceof Response) return sent;
  const { tag_id } = sent;
  await query("DELETE FROM card_tags WHERE card_id = $1 AND user_id = $2 AND tag_id = $3", [id, session.userId, tag_id]);
  return new Response(null, { status: 204 });
}
