import { NextRequest } from "next/server";
import { idParam, requireUser } from "@/lib/own-http";
import { deleteCircle, renameCircle } from "@/lib/circles";
import { cleanCircleName, MAX_CIRCLE_NAME } from "@/lib/circles-core";
import { circleFailure } from "@/lib/circles-http";

type Ctx = { params: Promise<{ id: string }> };

// The owner renames the circle.
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const who = await requireUser();
  if ("response" in who) return who.response;
  const id = idParam((await params).id);
  if (!id) return Response.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => null);
  const name = cleanCircleName(body?.name);
  if (!name) return Response.json({ error: `Give the circle a name of 1 to ${MAX_CIRCLE_NAME} characters.` }, { status: 400 });
  return circleFailure(await renameCircle(who.userId, id, name)) ?? Response.json({ ok: true });
}

// The owner deletes the circle. Everyone in it is simply no longer in a circle; nobody's writing is touched.
export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const who = await requireUser();
  if ("response" in who) return who.response;
  const id = idParam((await params).id);
  if (!id) return Response.json({ error: "Not found" }, { status: 404 });
  return circleFailure(await deleteCircle(who.userId, id)) ?? new Response(null, { status: 204 });
}
