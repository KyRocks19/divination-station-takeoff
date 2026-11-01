import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { getFigure } from "@/lib/geomancy-data";
import { readOwnMeaning, removeOwnMeaning, writeOwnMeaning } from "@/lib/own-meaning";

// A person's own meaning for a geomantic figure is kept like a rune's (lib/own-meaning.ts), under the figure's id ('geomancy-via'). A figure has one
// side, so only the "upright" fields are used. The address takes the id with or without the "geomancy-" start.
type Ctx = { params: Promise<{ figId: string }> };

const figureOf = (raw: string) => getFigure(raw.startsWith("geomancy-") ? raw : `geomancy-${raw}`);

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { figId } = await params;
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const f = figureOf(figId);
  if (!f) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(await readOwnMeaning(session.userId, f.id, f.latin));
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { figId } = await params;
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const f = figureOf(figId);
  if (!f) return Response.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => null);
  return Response.json(await writeOwnMeaning(session.userId, f.id, body));
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { figId } = await params;
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const f = figureOf(figId);
  if (!f) return Response.json({ error: "Not found" }, { status: 404 });
  await removeOwnMeaning(session.userId, f.id, new URL(req.url).searchParams.get("history") === "1");
  return new Response(null, { status: 204 });
}
