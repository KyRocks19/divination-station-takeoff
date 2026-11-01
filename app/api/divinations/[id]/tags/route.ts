import { NextRequest } from "next/server";
import { query, queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";
import { toId } from "@/lib/oracle";
import { idParam } from "@/lib/own-http";

// The tags on one reading with any tool but tarot (a tarot reading's tags are at /api/readings/[id]/tags). The tag list is the person's own and the
// same for every tool.
type Ctx = { params: Promise<{ id: string }> };

async function ownedReading(id: number, userId: number) {
  return queryOne<{ id: number }>("SELECT id FROM divinations WHERE id = $1 AND user_id = $2 AND kind <> 'tarot'", [id, userId]);
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const readingId = toId(id);
  if (!(await ownedReading(readingId, session.userId))) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(
    await query(
      "SELECT t.* FROM tags t JOIN divination_tags dt ON dt.tag_id = t.id WHERE dt.divination_id = $1 AND t.user_id = $2 ORDER BY t.name ASC",
      [readingId, session.userId]
    )
  );
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const readingId = toId(id);
  if (!(await ownedReading(readingId, session.userId))) return Response.json({ error: "Not found" }, { status: 404 });

  const { tag_id, name, color } = (await req.json().catch(() => ({}))) as { tag_id?: number; name?: string; color?: string };
  let resolvedTagId = tag_id;

  if (!resolvedTagId) {
    if (!name?.trim()) return Response.json({ error: "tag_id or name required" }, { status: 400 });
    if (name.trim().length > 60) return Response.json({ error: "A tag can be 60 characters at most" }, { status: 400 });
    const tag = await queryOne<{ id: number }>(
      "INSERT INTO tags (user_id, name, color) VALUES ($1, $2, $3) ON CONFLICT (user_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id",
      [session.userId, name.trim(), typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color) ? color : "#7c3aed"]
    );
    resolvedTagId = tag!.id;
  } else {
    const tag = await queryOne("SELECT id FROM tags WHERE id = $1 AND user_id = $2", [tag_id, session.userId]);
    if (!tag) return Response.json({ error: "Tag not found" }, { status: 404 });
  }

  await query("INSERT INTO divination_tags (divination_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [readingId, resolvedTagId]);
  return Response.json(await queryOne("SELECT * FROM tags WHERE id = $1 AND user_id = $2", [resolvedTagId, session.userId]), { status: 201 });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const readingId = toId(id);
  if (!(await ownedReading(readingId, session.userId))) return Response.json({ error: "Not found" }, { status: 404 });

  const { tag_id } = (await req.json().catch(() => ({}))) as { tag_id?: number };
  await query(
    "DELETE FROM divination_tags dt USING tags t WHERE dt.divination_id = $1 AND dt.tag_id = $2 AND t.id = dt.tag_id AND t.user_id = $3",
    [readingId, tag_id, session.userId]
  );
  return new Response(null, { status: 204 });
}
