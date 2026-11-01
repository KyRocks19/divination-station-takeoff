import { NextRequest } from "next/server";
import { query, queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";
import { idParam, jsonBody } from "@/lib/own-http";

async function getOwnedTag(id: string, userId: number) {
  return queryOne("SELECT * FROM tags WHERE id = $1 AND user_id = $2", [id, userId]);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const tag = await getOwnedTag(id, session.userId);
  if (!tag) return Response.json({ error: "Not found" }, { status: 404 });
  const sent = await jsonBody(req);
  if (sent instanceof Response) return sent;
  const { name, color } = sent;
  const updated = await queryOne(
    "UPDATE tags SET name = COALESCE($1, name), color = COALESCE($2, color) WHERE id = $3 RETURNING *",
    [name?.trim() ?? null, color ?? null, id]
  );
  return Response.json(updated);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const tag = await getOwnedTag(id, session.userId);
  if (!tag) return Response.json({ error: "Not found" }, { status: 404 });
  await query("DELETE FROM tags WHERE id = $1", [id]);
  return new Response(null, { status: 204 });
}
