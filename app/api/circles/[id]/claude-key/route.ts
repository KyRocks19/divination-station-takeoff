import { NextRequest } from "next/server";
import { idParam, requireUser } from "@/lib/own-http";
import { removeCircleKey, saveCircleKey } from "@/lib/circle-claude";
import { circleFailure } from "@/lib/circles-http";

type Ctx = { params: Promise<{ id: string }> };

// The circle's owner stores (PUT, body { key }) or removes (DELETE) the Claude key the circle uses. The key is encrypted before it is saved and is never
// sent back: the Circle page gets its last four characters. Nothing here logs the key.
export async function PUT(request: NextRequest, { params }: Ctx) {
  const who = await requireUser();
  if ("response" in who) return who.response;
  const id = idParam((await params).id);
  if (!id) return Response.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => null);
  const result = await saveCircleKey(who.userId, id, body?.key);
  return circleFailure(result) ?? Response.json({ ok: true, checked: result.ok ? result.value.checked : false });
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const who = await requireUser();
  if ("response" in who) return who.response;
  const id = idParam((await params).id);
  if (!id) return Response.json({ error: "Not found" }, { status: 404 });
  return circleFailure(await removeCircleKey(who.userId, id)) ?? new Response(null, { status: 204 });
}
