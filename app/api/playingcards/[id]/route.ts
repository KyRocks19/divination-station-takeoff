import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { cleanText, toId } from "@/lib/oracle";
import { loadDraw } from "@/lib/playingcards";
import { deleteReadingOf, setQuestionOf } from "@/lib/tool-reading";
import { idParam } from "@/lib/own-http";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const draw = await loadDraw(session.userId, toId(id));
  if (!draw) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(draw);
}

// Changes the question written with a draw. An empty question clears it. The cards that came up cannot be changed.
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!(await setQuestionOf(session.userId, toId(id), "playingcards", cleanText(body?.question)))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json(await loadDraw(session.userId, toId(id)));
}

// Deletes the draw: its shared record and, with it, the cards kept and what was written about it.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await deleteReadingOf(session.userId, toId(id), "playingcards"))) return Response.json({ error: "Not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
