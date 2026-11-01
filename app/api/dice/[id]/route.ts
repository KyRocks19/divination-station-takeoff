import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/session";
import { cleanText, toId } from "@/lib/oracle";
import { loadThrow } from "@/lib/dice";
import { idParam } from "@/lib/own-http";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const found = await loadThrow(session.userId, toId(id));
  if (!found) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(found);
}

// Changes the question written with a throw. An empty question clears it. What came up cannot be changed.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const updated = await query(
    "UPDATE divinations SET question = $1 WHERE id = $2 AND user_id = $3 AND kind = 'dice' RETURNING id",
    [cleanText(body?.question), toId(id), session.userId]
  );
  if (updated.length === 0) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(await loadThrow(session.userId, toId(id)));
}

// Deletes the throw: its shared record and, with it, the result rows and what was written about it.
// The person's own meanings for the faces are not touched.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const deleted = await query(
    "DELETE FROM divinations WHERE id = $1 AND user_id = $2 AND kind = 'dice' RETURNING id",
    [toId(id), session.userId]
  );
  if (deleted.length === 0) return Response.json({ error: "Not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
