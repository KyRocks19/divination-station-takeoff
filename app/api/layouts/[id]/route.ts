import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { toId } from "@/lib/oracle";
import { cleanLayoutInput, deleteLayout, loadLayout, updateLayout } from "@/lib/layouts";
import { idParam } from "@/lib/own-http";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const layout = await loadLayout(session.userId, toId(id));
  if (!layout) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(layout);
}

// Changes a layout. The body is the whole layout; its positions replace the old ones.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const input = cleanLayoutInput(await request.json().catch(() => null));
  if (typeof input === "string") return Response.json({ error: input }, { status: 400 });

  if (!(await updateLayout(session.userId, toId(id), input))) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(await loadLayout(session.userId, toId(id)));
}

// Deletes a layout. Readings made with it stay, with the names as they were.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await deleteLayout(session.userId, toId(id)))) return Response.json({ error: "Not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
