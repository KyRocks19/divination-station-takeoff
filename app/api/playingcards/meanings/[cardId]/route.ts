import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { getCard } from "@/lib/playingcards-data";
import { readOwnMeaning, removeOwnMeaning, writeOwnMeaning } from "@/lib/own-meaning";

// A person's own meaning for a playing card is kept like a rune's (lib/own-meaning.ts), under 'playing-H-7' and so on. A card has one side, so only the
// "upright" fields are used. The app gives no meaning of its own.
type Ctx = { params: Promise<{ cardId: string }> };

const cardOf = (meaningId: string) => (meaningId.startsWith("playing-") ? getCard(meaningId.slice(8)) : null);

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { cardId } = await params;
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const card = cardOf(cardId);
  if (!card) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(await readOwnMeaning(session.userId, card.meaningId, card.name));
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { cardId } = await params;
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const card = cardOf(cardId);
  if (!card) return Response.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => null);
  return Response.json(await writeOwnMeaning(session.userId, card.meaningId, body));
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { cardId } = await params;
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const card = cardOf(cardId);
  if (!card) return Response.json({ error: "Not found" }, { status: 404 });
  await removeOwnMeaning(session.userId, card.meaningId, new URL(req.url).searchParams.get("history") === "1");
  return new Response(null, { status: 204 });
}
