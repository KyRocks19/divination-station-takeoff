import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/session";
import { toId } from "@/lib/oracle";
import { loadSwing } from "@/lib/pendulum";
import { idParam } from "@/lib/own-http";

// Deletes one earlier wording of a swing's meaning. The swing and its current wording are not touched.
// Returns the swing with its earlier wordings as they are now.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; wid: string }> }
) {
  const { id, wid } = await params;
  if (idParam(id) === null || idParam(wid) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const deleted = await query(
    "DELETE FROM pendulum_swing_revisions WHERE id = $1 AND swing_id = $2 AND user_id = $3 RETURNING id",
    [toId(wid), toId(id), session.userId]
  );
  if (deleted.length === 0) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(await loadSwing(session.userId, toId(id)));
}
