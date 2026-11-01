import { NextRequest } from "next/server";
import { removeOwnLink } from "@/lib/own-archetypes";
import { idParam, requireUser } from "@/lib/own-http";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireUser();
  if ("response" in who) return who.response;
  const id = idParam((await params).id);
  if (!id || !(await removeOwnLink(who.userId, id))) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ok: true });
}
