import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { bodyOf, idParam } from "@/lib/own-http";
import { MAX_PRACTICE_WORDS, isPracticeSuit } from "@/lib/tarot-practice-core";
import { guessTrial } from "@/lib/tarot-practice";

// Saves the person's guess on their sealed practice card ({ suit, words }) and only then returns the card. A card already guessed cannot be
// guessed again. Only the person's own.
type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = idParam((await params).id);
  if (!id) return Response.json({ error: "Not found" }, { status: 404 });
  const body = (await bodyOf(request)) as { suit?: unknown; words?: unknown } | null;
  if (!isPracticeSuit(body?.suit)) return Response.json({ error: "Choose the suit you sense." }, { status: 400 });
  if (body.words !== undefined && body.words !== null && typeof body.words !== "string") return Response.json({ error: "words must be text" }, { status: 400 });
  const words = typeof body.words === "string" ? body.words.trim() : "";
  if (words.length > MAX_PRACTICE_WORDS) return Response.json({ error: `That is too long (${MAX_PRACTICE_WORDS} characters at most).` }, { status: 400 });
  const card = await guessTrial(session.userId, id, body.suit, words || null);
  if (!card) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ card });
}
