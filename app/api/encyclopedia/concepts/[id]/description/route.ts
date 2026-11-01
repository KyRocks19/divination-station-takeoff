import { NextRequest } from "next/server";
import { streamClaude } from "@/lib/ai-stream";
import { claudeAccess } from "@/lib/claude-access";
import { getSession } from "@/lib/session";
import { getCardById } from "@/lib/cards";
import { query } from "@/lib/db";
import { conceptQuery, showsSensitive } from "@/lib/concept-visibility";
import { deleteOwnDescription, getOwnDescription, saveOwnDescription } from "@/lib/concept-descriptions";
import { idParam } from "@/lib/own-http";
import { FEATHERED } from "@/lib/edition";

// Hiero writes a description of a concept for the person who asks, and keeps it for that person alone (concept_descriptions_user).
// Nothing it writes is shown to anyone else: a description for everyone would be text nobody reviewed, published under the app's name.

async function visibleConcept(userId: number, conceptId: number) {
  const show = await showsSensitive(userId);
  const [concept] = await conceptQuery<{ id: number; display_name: string }>(
    "SELECT c.id, c.display_name FROM concepts c WHERE c.id = $1 AND {visible}",
    [conceptId],
    show
  );
  return concept ?? null;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  // Claude writes the description, and the Feathered edition has no AI (docs/plan-feathered-edition.md).
  if (FEATHERED) return Response.json({ error: "Not found" }, { status: 404 });

  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const conceptId = parseInt(id, 10);
  if (isNaN(conceptId)) return Response.json({ error: "Invalid id" }, { status: 400 });

  const concept = await visibleConcept(session.userId, conceptId);
  if (!concept) return Response.json({ error: "Not found" }, { status: 404 });

  // The person's own saved description is returned without asking Claude again.
  const own = await getOwnDescription(session.userId, conceptId);
  if (own) {
    return new Response(own, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  const access = await claudeAccess(session.userId, "concept-description");
  if (!access.ok) return access.response;
  const client = access.client;

  const cardRows = await query(
    "SELECT card_id FROM card_concepts WHERE concept_id = $1",
    [conceptId]
  ) as any[];
  const cardNames = cardRows
    .map((r: any) => getCardById(r.card_id)?.name)
    .filter(Boolean)
    .join(", ");

  const systemPrompt = `You are Hiero, a deep reader of the tarot tradition steeped in the symbolism of the Pixie-Smith deck (Pamela Colman Smith's 1909 tarot), Jungian archetypes, and the esoteric history of the cards. You write with clarity and warmth — neither dry encyclopedia nor florid mysticism. Your descriptions illuminate the inner logic of tarot concepts and their emotional resonance. A concept is a word people have linked to a card; it is not a prediction or a verdict about anyone. If the word names something painful or harmful, write plainly and with care, and give no medical, legal or financial advice.`;

  const userPrompt = `Write a description of the tarot concept "${concept.display_name}" in 2–3 short paragraphs. This concept appears in the following cards: ${cardNames || "several cards"}. Explain what this concept means in the context of tarot readings — its archetypal quality, emotional texture, and practical significance when it appears. Be specific and grounded.`;

  const stream = await client.messages.stream({
    model: process.env.INTERPRET_MODEL ?? "claude-haiku-4-5",
    max_tokens: 600,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const userId = session.userId;
  return streamClaude(stream, "concept-description", async (text) => {
    // Kept for this person only, after streaming completes.
    await saveOwnDescription(userId, conceptId, text);
  });
}

/** Removes the description Hiero wrote for this person, so they can ask again. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const conceptId = parseInt(id, 10);
  if (isNaN(conceptId)) return Response.json({ error: "Invalid id" }, { status: 400 });

  await deleteOwnDescription(session.userId, conceptId);
  return Response.json({ ok: true });
}
