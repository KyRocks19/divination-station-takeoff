import { NextRequest } from "next/server";
import { query, queryOne, logCardDraw } from "@/lib/db";
import { getSession } from "@/lib/session";
import { TAROT_DECK } from "@/lib/cards";
import { createRng } from "@/lib/rng";
import { jsonBody } from "@/lib/own-http";

interface DrawnCard {
  position: string;
  card_id: string;
  card_name: string;
  reversed: boolean;
}

export async function POST(request: NextRequest) {
  const sent = await jsonBody(request);
  if (sent instanceof Response) return sent;
  const { reading_id, card_index } = sent;
  if (reading_id == null || card_index == null) {
    return Response.json({ error: "reading_id and card_index required" }, { status: 400 });
  }

  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const reading = await queryOne(
    "SELECT * FROM readings WHERE id = $1 AND user_id = $2",
    [reading_id, session.userId!]
  ) as any;

  const userRow = await queryOne<{ rng_method: string | null }>(
    "SELECT rng_method FROM users WHERE id = $1",
    [session.userId!]
  );
  const rng = await createRng(userRow?.rng_method ?? "math");
  if (!reading) return Response.json({ error: "Reading not found" }, { status: 404 });

  const spreadCards: DrawnCard[] = JSON.parse(reading.cards);
  // Only a card that is in this reading can have a clarifier (and no odd keys such as "__proto__" reach the object below).
  if (!Number.isInteger(card_index) || card_index < 0 || card_index >= spreadCards.length) {
    return Response.json({ error: "card_index must be the place of a card in this reading" }, { status: 400 });
  }
  const clarifiers: Record<number, DrawnCard[]> = reading.clarifiers
    ? JSON.parse(reading.clarifiers)
    : {};

  const usedIds = new Set<string>(spreadCards.map((c) => c.card_id));
  for (const group of Object.values(clarifiers)) {
    for (const c of group) usedIds.add(c.card_id);
  }

  const remaining = TAROT_DECK.filter((c) => !usedIds.has(c.id));
  if (remaining.length === 0) {
    return Response.json({ error: "No cards remaining in deck" }, { status: 400 });
  }

  const drawn = remaining[Math.floor(rng() * remaining.length)];
  const reversed = rng() < 0.5;
  const existingCount = clarifiers[card_index]?.length ?? 0;

  const newCard: DrawnCard = {
    card_id: drawn.id,
    card_name: drawn.name,
    reversed,
    position: `Clarifier ${existingCount + 1}`,
  };

  if (!clarifiers[card_index]) clarifiers[card_index] = [];
  clarifiers[card_index].push(newCard);

  await query(
    "UPDATE readings SET clarifiers = $1 WHERE id = $2",
    [JSON.stringify(clarifiers), reading_id]
  );

  const originalCard = spreadCards[card_index];
  await logCardDraw({
    userId: session.userId!,
    readingId: reading_id,
    cardId: drawn.id,
    cardName: drawn.name,
    positionName: newCard.position,
    spreadName: reading.spread_name,
    reversed,
    isClarifier: true,
    clarifiesCardId: originalCard.card_id,
    clarifiesPosition: originalCard.position,
  });

  return Response.json(newCard);
}
