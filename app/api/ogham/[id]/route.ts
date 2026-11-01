import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/session";
import { cleanText, toId } from "@/lib/oracle";
import { loadDraw } from "@/lib/ogham";
import { idParam } from "@/lib/own-http";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const draw = await loadDraw(session.userId, toId(id));
  if (!draw) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(draw);
}

// Changes the question written with a draw. An empty question clears it. The ogham that came up cannot be changed.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const updated = await query(
    "UPDATE divinations SET question = $1 WHERE id = $2 AND user_id = $3 AND kind = 'ogham' RETURNING id",
    [cleanText(body?.question), toId(id), session.userId]
  );
  if (updated.length === 0) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(await loadDraw(session.userId, toId(id)));
}

// Deletes the draw: its shared record and, with it, the stave rows and what was written about it.
// The person's own stave meanings are not touched.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const deleted = await query(
    "DELETE FROM divinations WHERE id = $1 AND user_id = $2 AND kind = 'ogham' RETURNING id",
    [toId(id), session.userId]
  );
  if (deleted.length === 0) return Response.json({ error: "Not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
