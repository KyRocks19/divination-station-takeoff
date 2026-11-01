import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { deleteOwnTake } from "@/lib/divination-takes";

// A person deleting one of their own takes on divination (migration 098): DELETE /api/own-takes/12. Only their own.

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const n = Number(id);
  if (!Number.isSafeInteger(n) || n <= 0) return Response.json({ error: "Not a take" }, { status: 404 });
  if (!(await deleteOwnTake(session.userId, n))) return Response.json({ error: "Not a take" }, { status: 404 });
  return Response.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
}
