import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { toId } from "@/lib/oracle";
import { deleteNote } from "@/lib/companion-queue";
import { idParam } from "@/lib/own-http";

// Deletes a question the person kept.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await deleteNote(session.userId, toId(id)))) return Response.json({ error: "Not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
