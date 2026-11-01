import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/session";
import { toId } from "@/lib/oracle";
import { idParam } from "@/lib/own-http";

// Deletes one earlier version of a meaning. The current text is not touched.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; rid: string }> }) {
  const { id, rid } = await params;
  if (idParam(id) === null || idParam(rid) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const deleted = await query(
    "DELETE FROM oracle_card_meaning_revisions WHERE id = $1 AND meaning_id = $2 AND user_id = $3 RETURNING id",
    [toId(rid), toId(id), session.userId]
  );
  if (deleted.length === 0) return Response.json({ error: "Not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
