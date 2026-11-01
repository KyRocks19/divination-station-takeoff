import { NextRequest } from "next/server";
import { cleanLink, cleanPiece } from "@/lib/own-archetypes-core";
import { addOwnLink, linksForPiece } from "@/lib/own-archetypes";
import { bodyOf, problem, requireUser } from "@/lib/own-http";

// The signed-in person's own links from a piece (a rune, a tarot card, one of their oracle items) to an archetype or a
// concept: a shared archetype, one of their own, or one of their own concepts. Private to them.

/** GET ?symbol_id=rune-fehu  or  ?oracle_card_id=12 : the person's own links from that piece. */
export async function GET(request: NextRequest) {
  const who = await requireUser();
  if ("response" in who) return who.response;
  const sp = request.nextUrl.searchParams;
  const piece = cleanPiece({ symbol_id: sp.get("symbol_id") ?? undefined, oracle_card_id: sp.get("oracle_card_id") ?? undefined });
  if (!piece.ok) return Response.json({ error: piece.error }, { status: 400 });
  return Response.json(await linksForPiece(who.userId, piece.value));
}

/** POST { symbol_id | oracle_card_id, archetype | user_archetype_id | user_concept_id, aspect? } */
export async function POST(request: NextRequest) {
  const who = await requireUser();
  if ("response" in who) return who.response;
  const input = cleanLink(await bodyOf(request));
  if (!input.ok) return Response.json({ error: input.error }, { status: 400 });
  const made = await addOwnLink(who.userId, input.value);
  if (!made.ok) return problem(made.error, "links");
  return Response.json({ id: made.value.id }, { status: 201 });
}
