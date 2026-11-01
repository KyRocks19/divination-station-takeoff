import { NextRequest } from "next/server";
import { query, queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";
import { idParam } from "@/lib/own-http";

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/journals/[id]">) {
  const { id } = await ctx.params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const journal = await queryOne(
    `SELECT j.id FROM journals j
     LEFT JOIN readings r ON r.id = j.reading_id
     LEFT JOIN divinations d ON d.id = j.divination_id
     WHERE j.id = $1 AND COALESCE(r.user_id, d.user_id) = $2`,
    [id, session.userId!]
  );
  if (!journal) return Response.json({ error: "Not found" }, { status: 404 });
  await query("DELETE FROM journals WHERE id = $1", [id]);
  return new Response(null, { status: 204 });
}
