import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { isTakeId } from "@/lib/divination-takes-core";
import { setTakeKept } from "@/lib/divination-takes";

// A person keeping one take on divination from the home page, or letting it go (migration 098): PUT /api/divination-takes/plain-pause
// keeps it, DELETE lets it go. Only takes in lib/divination-takes-core.ts can be kept. The answer holds only the person's own choice.

const NO_STORE = { "Cache-Control": "private, no-store" };

async function change(id: string, userId: number, kept: boolean) {
  if (!isTakeId(id)) return Response.json({ error: "Not a take" }, { status: 404 });
  const result = await setTakeKept(userId, id, kept);
  if (result === "limit") return Response.json({ error: "You have kept as many takes as can be kept" }, { status: 409 });
  if (result === "unavailable") return Response.json({ error: "Keeping takes is not ready on this copy yet" }, { status: 503 });
  return Response.json({ ok: true, kept }, { headers: NO_STORE });
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
