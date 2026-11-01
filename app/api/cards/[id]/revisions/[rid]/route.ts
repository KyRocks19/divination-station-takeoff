import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; rid: string }> }) {
  const { id, rid } = await params;
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const deleted = await query(
    "DELETE FROM card_meaning_revisions WHERE id = $1 AND user_id = $2 AND card_id = $3 RETURNING id",
    [Number(rid) || 0, session.userId, id]
  );
  if (deleted.length === 0) return Response.json({ error: "Not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
