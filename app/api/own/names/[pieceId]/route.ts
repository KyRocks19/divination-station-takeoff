import { NextRequest } from "next/server";
import { bodyOf, requireUser } from "@/lib/own-http";
import { MAX_OWN_NAME, canNamePiece, cleanOwnName } from "@/lib/own-names-core";
import { removeOwnName, saveOwnName } from "@/lib/own-names";

// The signed-in person's own name for one piece, such as a side of a knucklebone. Private to them: the piece is named by its id, and every
// query is for the signed-in person only. The app gives no names of its own.
type Ctx = { params: Promise<{ pieceId: string }> };

export async function PUT(request: NextRequest, { params }: Ctx) {
  const who = await requireUser();
  if ("response" in who) return who.response;
  const { pieceId } = await params;
  if (!canNamePiece(pieceId)) return Response.json({ error: "Not found" }, { status: 404 });
  const body = (await bodyOf(request)) as { name?: unknown } | null;
  const name = cleanOwnName(body?.name);
  if (!name) return Response.json({ error: `Give it a name of 1 to ${MAX_OWN_NAME} characters, or remove the name.` }, { status: 400 });
  await saveOwnName(who.userId, pieceId, name);
  return Response.json({ ok: true, name });
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const who = await requireUser();
  if ("response" in who) return who.response;
  const { pieceId } = await params;
  if (!canNamePiece(pieceId)) return Response.json({ error: "Not found" }, { status: 404 });
  await removeOwnName(who.userId, pieceId);
  return new Response(null, { status: 204 });
}
