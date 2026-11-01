import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { toId } from "@/lib/oracle";
import { removeCompanionJob } from "@/lib/companion-queue";
import { idParam } from "@/lib/own-http";

// Stops a waiting request, or clears an answered or failed one (the "Discard" and "Close" buttons). Kept questions are not affected.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await removeCompanionJob(session.userId, toId(id)))) return Response.json({ error: "Not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
