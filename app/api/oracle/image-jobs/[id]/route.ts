import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { removeJob } from "@/lib/image-queue";
import { toId } from "@/lib/oracle";
import { idParam } from "@/lib/own-http";

// Stops a waiting picture, or clears a finished or failed one. A picture the person has already saved is not affected.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await removeJob(session.userId, toId(id)))) return Response.json({ error: "Not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
