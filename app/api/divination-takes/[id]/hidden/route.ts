import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { isTakeId } from "@/lib/divination-takes-core";
import { setTakeHidden } from "@/lib/divination-takes";

// A person hiding one take on divination they do not want to see again, or showing it again (migration 105):
// PUT /api/divination-takes/plain-pause/hidden hides it, DELETE shows it again. Hiding a kept take lets go of it too.
// Only takes in lib/divination-takes-core.ts can be hidden. The answer holds only the person's own choice.

const NO_STORE = { "Cache-Control": "private, no-store" };

async function change(id: string, userId: number, hidden: boolean) {
  if (!isTakeId(id)) return Response.json({ error: "Not a take" }, { status: 404 });
  const result = await setTakeHidden(userId, id, hidden);
  if (result === "unavailable") return Response.json({ error: "Hiding takes is not ready on this copy yet" }, { status: 503 });
  return Response.json({ ok: true, hidden }, { headers: NO_STORE });
}

export async function PUT(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  return change(id, session.userId, true);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  return change(id, session.userId, false);
}
