import { NextRequest } from "next/server";
import { query, queryOne, withTransaction } from "@/lib/db";
import { getSession } from "@/lib/session";
import { cleanText, toId } from "@/lib/oracle";
import { idParam, jsonBody } from "@/lib/own-http";

// Changes a meaning. The text it replaces is kept as an earlier version, dated when it was written.
// A field left out of the body is unchanged. Empty content is allowed: the meaning stays, with its history.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId;
  const meaningId = toId(id);

  const current = await queryOne<{ label: string | null; content: string; reversed: number; updated_at: string }>(
    "SELECT label, content, reversed, updated_at FROM oracle_card_meanings WHERE id = $1 AND user_id = $2",
    [meaningId, userId]
  );
  if (!current) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await jsonBody(request);
  if (body instanceof Response) return body;
  const label = body.label === undefined ? current.label : cleanText(body.label);
  const content = body.content === undefined ? current.content : cleanText(body.content) ?? "";

  // Marking a meaning as "for the card upside down" changes no words, so it adds no version.
  if (body.reversed !== undefined && (body.reversed ? 1 : 0) !== current.reversed) {
    await query(
      "UPDATE oracle_card_meanings SET reversed = $1 WHERE id = $2 AND user_id = $3",
      [body.reversed ? 1 : 0, meaningId, userId]
    );
  }

  if (label !== current.label || content !== current.content) {
    await withTransaction(async (client) => {
      // An emptied meaning has no words to keep, so it adds no version.
      if (current.content || current.label) {
        await client.query(
          `INSERT INTO oracle_card_meaning_revisions (user_id, meaning_id, label, content, created_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [userId, meaningId, current.label, current.content, current.updated_at]
        );
      }
      await client.query(
        "UPDATE oracle_card_meanings SET label = $1, content = $2, updated_at = NOW() WHERE id = $3 AND user_id = $4",
        [label, content, meaningId, userId]
      );
    });
  }

  return Response.json({ ok: true });
}

// Deletes the meaning and every earlier version of it.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const deleted = await query(
    "DELETE FROM oracle_card_meanings WHERE id = $1 AND user_id = $2 RETURNING id",
    [toId(id), session.userId]
  );
  if (deleted.length === 0) return Response.json({ error: "Not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
