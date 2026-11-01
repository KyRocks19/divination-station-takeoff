import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { listInterviews } from "@/lib/divinations";
import { toId } from "@/lib/oracle";
import { idParam } from "@/lib/own-http";

// The interviews the AI interviewer saved for one reading of any kind but tarot (its questions, the person's answers, then its reading), oldest
// first. They are kept apart from the person's own writing; the person can delete one with DELETE /api/divinations/[id]/journals/[jid].
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await listInterviews(session.userId, toId(id)));
}
