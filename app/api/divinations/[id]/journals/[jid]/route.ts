import { NextRequest } from "next/server";
import { query, queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";
import { cleanText, toId } from "@/lib/oracle";
import { idParam, jsonBody } from "@/lib/own-http";

// Changes the words of an entry and/or its "thinking mind" marker. To empty an entry, delete it.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; jid: string }> }) {
  const { id, jid } = await params;
  if (idParam(id) === null || idParam(jid) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await jsonBody(request);
  if (body instanceof Response) return body;
  const hasContent = "content" in body;
  const content = hasContent ? cleanText(body.content) : null;
  if (hasContent && !content) return Response.json({ error: "content is required" }, { status: 400 });
  const hasMarker = "thinking_mind" in body;
  if (!hasContent && !hasMarker) return Response.json({ error: "Nothing to change" }, { status: 400 });

  const entry = await queryOne(
    `UPDATE journals j SET content = COALESCE($1, j.content), thinking_mind = CASE WHEN $5::boolean THEN $6 ELSE j.thinking_mind END
     FROM divinations d
     WHERE j.id = $2 AND j.divination_id = d.id AND d.id = $3 AND d.user_id = $4 AND j.author = 'user'
     RETURNING j.id, j.kind, j.thinking_mind, j.content, j.created_at`,
    [content, toId(jid), toId(id), session.userId, hasMarker, body.thinking_mind ? 1 : 0]
  );
  if (!entry) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(entry);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; jid: string }> }) {
  const { id, jid } = await params;
  if (idParam(id) === null || idParam(jid) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const deleted = await query(
    `DELETE FROM journals j USING divinations d
     WHERE j.id = $1 AND j.divination_id = d.id AND d.id = $2 AND d.user_id = $3
     RETURNING j.id`,
    [toId(jid), toId(id), session.userId]
  );
  if (deleted.length === 0) return Response.json({ error: "Not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
