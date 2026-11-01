import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/session";
import { cleanText, toId } from "@/lib/oracle";
import { loadAnswer } from "@/lib/pendulum";
import { idParam } from "@/lib/own-http";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const answer = await loadAnswer(session.userId, toId(id));
  if (!answer) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(answer);
}

// Changes the question written with an answer. An empty question clears it. The swing that came up cannot be changed.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const updated = await query(
    "UPDATE divinations SET question = $1 WHERE id = $2 AND user_id = $3 AND kind = 'pendulum' RETURNING id",
    [cleanText(body?.question), toId(id), session.userId]
  );
  if (updated.length === 0) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(await loadAnswer(session.userId, toId(id)));
}

// Deletes the answer: its shared record and, with it, the pendulum's own row and what was written about it.
// The person's swings are not touched.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const deleted = await query(
    "DELETE FROM divinations WHERE id = $1 AND user_id = $2 AND kind = 'pendulum' RETURNING id",
    [toId(id), session.userId]
  );
  if (deleted.length === 0) return Response.json({ error: "Not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
