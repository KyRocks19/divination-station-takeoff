import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { removeFeedback, review } from "@/lib/feedback";
import { toId } from "@/lib/oracle";
import { idParam } from "@/lib/own-http";

// The owner marks a note seen or done and writes a reply the sender can read. Body: { status?, reply? }.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || (body.status === undefined && body.reply === undefined)) {
    return Response.json({ error: "status or reply is required" }, { status: 400 });
  }
  const result = await review(toId(id), body);
  if (typeof result === "string") return Response.json({ error: result }, { status: 400 });
  return result ? Response.json({ ok: true }) : Response.json({ error: "Not found" }, { status: 404 });
}

// A person deletes their own note (the owner can delete any).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await removeFeedback(toId(id), session.userId, session.isAdmin === true))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return new Response(null, { status: 204 });
}
