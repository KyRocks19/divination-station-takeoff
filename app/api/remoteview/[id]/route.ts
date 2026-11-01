import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { cleanText, toId } from "@/lib/oracle";
import { loadTrial } from "@/lib/remoteview";
import { deleteReadingOf, setQuestionOf } from "@/lib/tool-reading";
import { idParam } from "@/lib/own-http";

type Ctx = { params: Promise<{ id: string }> };

// One trial, as far as it may be shown: options after sealing, target after the choice.
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const trial = await loadTrial(session.userId, toId(id));
  if (!trial) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(trial);
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!(await setQuestionOf(session.userId, toId(id), "remoteview", cleanText(body?.question)))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json(await loadTrial(session.userId, toId(id)));
}

// Deletes the trial, sealed or not, with what was written about it.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await deleteReadingOf(session.userId, toId(id), "remoteview"))) return Response.json({ error: "Not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
