import { NextRequest } from "next/server";
import { query, queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";
import { cleanText, toId } from "@/lib/oracle";
import { cleanMinutes, loadSession } from "@/lib/scrying";
import { idParam } from "@/lib/own-http";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const found = await loadSession(session.userId, toId(id));
  if (!found) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(found);
}

// Changes the question written with a session (an empty question clears it), or the time that was kept
// (`minutes`: a whole number, or null to remove it). Only the fields present in the body are changed.
// The surface cannot be changed.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "Invalid JSON" }, { status: 400 });

  const owned = await queryOne<{ id: number }>(
    "SELECT id FROM divinations WHERE id = $1 AND user_id = $2 AND kind = 'scrying'",
    [toId(id), userId]
  );
  if (!owned) return Response.json({ error: "Not found" }, { status: 404 });

  if (body.minutes !== undefined && body.minutes !== null && cleanMinutes(body.minutes) === null) {
    return Response.json({ error: "minutes must be a whole number from 0 to 1440, or null" }, { status: 400 });
  }
  if (body.question !== undefined) {
    await query("UPDATE divinations SET question = $1 WHERE id = $2 AND user_id = $3", [
      cleanText(body.question),
      owned.id,
      userId,
    ]);
  }
  if (body.minutes !== undefined) {
    await query("UPDATE scrying_sessions SET minutes = $1 WHERE divination_id = $2 AND user_id = $3", [
      cleanMinutes(body.minutes),
      owned.id,
      userId,
    ]);
  }
  return Response.json(await loadSession(userId, owned.id));
}

// Deletes the session: its shared record and, with it, the surface row and what was written about it.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const deleted = await query(
    "DELETE FROM divinations WHERE id = $1 AND user_id = $2 AND kind = 'scrying' RETURNING id",
    [toId(id), session.userId]
  );
  if (deleted.length === 0) return Response.json({ error: "Not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
