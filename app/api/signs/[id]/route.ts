import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { cleanText, toId } from "@/lib/oracle";
import { loadNote } from "@/lib/signs";
import { deleteReadingOf, setQuestionOf } from "@/lib/tool-reading";
import { idParam } from "@/lib/own-http";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const note = await loadNote(session.userId, toId(id));
  if (!note) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(note);
}

// Changes the question written with a note. An empty question clears it. The note itself is not changed here: what changed is written as an entry.
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!(await setQuestionOf(session.userId, toId(id), "signs", cleanText(body?.question)))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json(await loadNote(session.userId, toId(id)));
}

// Deletes the note: its shared record and, with it, the text kept and what was written about it.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await deleteReadingOf(session.userId, toId(id), "signs"))) return Response.json({ error: "Not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
