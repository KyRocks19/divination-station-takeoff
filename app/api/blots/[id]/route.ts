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
  const cast = await loadCast(session.userId, "blots", toId(id));
  if (!cast) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(cast);
}

// Changes the question written with an ink blot. An empty question clears it. The blot itself cannot be changed.
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!(await setQuestionOf(session.userId, toId(id), "blots", cleanText(body?.question)))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json(await loadCast(session.userId, "blots", toId(id)));
}

// Deletes the blot: its shared record and, with it, the seed and what was written about it.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await deleteReadingOf(session.userId, toId(id), "blots"))) return Response.json({ error: "Not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
