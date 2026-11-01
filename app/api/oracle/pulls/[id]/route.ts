import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/session";
import { cleanText, loadPull, toId } from "@/lib/oracle";
import { idParam, jsonBody } from "@/lib/own-http";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const pull = await loadPull(session.userId, toId(id));
  if (!pull) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(pull);
}

// Changes the question or intention written with a pull. An empty question clears it. What came up cannot be changed.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await jsonBody(request);
  if (body instanceof Response) return body;
  const updated = await query(
    "UPDATE divinations SET question = $1 WHERE id = $2 AND user_id = $3 AND kind = 'oracle' RETURNING id",
    [cleanText(body.question), toId(id), session.userId]
  );
  if (updated.length === 0) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(await loadPull(session.userId, toId(id)));
}

// Deletes the pull: its shared record and, with it, the oracle deck's own rows for it.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const deleted = await query(
    "DELETE FROM divinations WHERE id = $1 AND user_id = $2 AND kind = 'oracle' RETURNING id",
    [toId(id), session.userId]
  );
  if (deleted.length === 0) return Response.json({ error: "Not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
