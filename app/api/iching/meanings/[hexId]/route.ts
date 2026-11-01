import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { getHexagram } from "@/lib/iching-data";
import { readOwnMeaning, removeOwnMeaning, writeOwnMeaning } from "@/lib/own-meaning";

// A person's own meaning for a hexagram is kept like a rune's (lib/own-meaning.ts), under the hexagram's id ('hexagram-12'). A hexagram has one
// side, so only the "upright" fields are used.
type Ctx = { params: Promise<{ hexId: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { hexId } = await params;
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const h = getHexagram(hexId);
  if (!h) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(await readOwnMeaning(session.userId, h.id, h.pinyin));
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { hexId } = await params;
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const h = getHexagram(hexId);
  if (!h) return Response.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => null);
  return Response.json(await writeOwnMeaning(session.userId, h.id, body));
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { hexId } = await params;
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const h = getHexagram(hexId);
  if (!h) return Response.json({ error: "Not found" }, { status: 404 });
  await removeOwnMeaning(session.userId, h.id, new URL(req.url).searchParams.get("history") === "1");
  return new Response(null, { status: 204 });
}
