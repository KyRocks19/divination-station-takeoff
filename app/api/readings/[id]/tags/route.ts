import { NextRequest } from "next/server";
import { query, queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";
import { idParam, jsonBody } from "@/lib/own-http";

async function getOwnedReading(id: string, userId: number) {
  return queryOne("SELECT id FROM readings WHERE id = $1 AND user_id = $2", [id, userId]);
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!await getOwnedReading(id, session.userId)) return Response.json({ error: "Not found" }, { status: 404 });
  const tags = await query(
    "SELECT t.* FROM tags t JOIN reading_tags rt ON rt.tag_id = t.id WHERE rt.reading_id = $1 ORDER BY t.name ASC",
    [id]
  );
  return Response.json(tags);
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!await getOwnedReading(id, session.userId)) return Response.json({ error: "Not found" }, { status: 404 });

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
    "INSERT INTO reading_tags (reading_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [id, resolvedTagId]
  );
  const tag = await queryOne("SELECT * FROM tags WHERE id = $1", [resolvedTagId]);
  return Response.json(tag, { status: 201 });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!await getOwnedReading(id, session.userId)) return Response.json({ error: "Not found" }, { status: 404 });

  const sent = await jsonBody(req);
  if (sent instanceof Response) return sent;
  const { tag_id } = sent;
  await query("DELETE FROM reading_tags WHERE reading_id = $1 AND tag_id = $2", [id, tag_id]);
  return new Response(null, { status: 204 });
}
