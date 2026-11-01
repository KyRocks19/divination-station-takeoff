import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { cleanText, toId } from "@/lib/oracle";
import { loadCast } from "@/lib/blots";
import { deleteReadingOf, setQuestionOf } from "@/lib/tool-reading";
import { idParam } from "@/lib/own-http";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const cast = await loadCast(session.userId, "tea", toId(id));
  if (!cast) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(cast);
}

// Changes the question written with a cup. An empty question clears it. The leaves themselves cannot be changed. The cup's own kind is used, because a cup
// saved before the split keeps kind 'blots' until migration 100 is applied.
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const cast = await loadCast(session.userId, "tea", toId(id));
  const body = await request.json().catch(() => null);
  if (!cast || !(await setQuestionOf(session.userId, cast.id, cast.kind, cleanText(body?.question)))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json(await loadCast(session.userId, "tea", cast.id));
}

// Deletes the cup: its shared record and, with it, the seed and what was written about it.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const cast = await loadCast(session.userId, "tea", toId(id));
  if (!cast || !(await deleteReadingOf(session.userId, cast.id, cast.kind))) return Response.json({ error: "Not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
