import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/session";
import { tooLong } from "@/lib/limits";
import { idParam, jsonBody } from "@/lib/own-http";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const conceptId = parseInt(id, 10);
  if (isNaN(conceptId)) return Response.json({ error: "Invalid id" }, { status: 400 });

  const rows = await query(
    "SELECT content FROM concept_notes WHERE concept_id = $1 AND user_id = $2",
    [conceptId, session.userId]
  ) as any[];

  return Response.json({ content: rows[0]?.content ?? null });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const conceptId = parseInt(id, 10);
  if (isNaN(conceptId)) return Response.json({ error: "Invalid id" }, { status: 400 });

  const sent = await jsonBody(req);
  if (sent instanceof Response) return sent;
  const { content } = sent;
  if (typeof content !== "string") return Response.json({ error: "content required" }, { status: 400 });
  if (tooLong(content, 20000)) return Response.json({ error: "That note is too long (20,000 characters)" }, { status: 400 });

  if (content.trim() === "") {
    await query(
      "DELETE FROM concept_notes WHERE concept_id = $1 AND user_id = $2",
      [conceptId, session.userId]
    );
  } else {
    await query(
      `INSERT INTO concept_notes (concept_id, user_id, content, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (concept_id, user_id) DO UPDATE SET content = $3, updated_at = NOW()`,
      [conceptId, session.userId, content.trim()]
    );
  }

  return Response.json({ ok: true });
}
