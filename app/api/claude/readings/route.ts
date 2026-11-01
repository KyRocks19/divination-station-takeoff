import { NextRequest } from "next/server";
import { query, queryOne, logCardDraw, withTransaction } from "@/lib/db";
import { insertDivination, tarotSummary } from "@/lib/divinations";
import { getClaudeApiUserId } from "@/lib/claude-api";
import { drawCards, getCardById } from "@/lib/cards";
import { createRng } from "@/lib/rng";
import { getPrefs } from "@/lib/prefs";
import { skyAt } from "@/lib/sky";
import { jsonBody } from "@/lib/own-http";

export async function GET(request: NextRequest) {
  const userId = await getClaudeApiUserId(request);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const readings = await query(
    "SELECT * FROM readings WHERE user_id = $1 ORDER BY created_at DESC",
    [userId]
  ) as any[];
  const result = await Promise.all(
    readings.map(async (r) => {
      const journals = await query(
        "SELECT * FROM journals WHERE reading_id = $1 ORDER BY created_at ASC",
        [r.id]
      );
      return { ...r, cards: JSON.parse(r.cards), journals };
    })
  );
  return Response.json(result);
}

export async function POST(request: NextRequest) {
  const userId = await getClaudeApiUserId(request);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await jsonBody(request);
  if (body instanceof Response) return body;
  const { spread_name, title, question, positions, auto_draw, cards: manualCards, tz } = body;

  if (!spread_name || !Array.isArray(positions) || positions.length === 0) {
    return Response.json({ error: "spread_name and positions[] are required" }, { status: 400 });
  }

  let cards: { position: string; card_id: string; card_name: string; reversed: boolean }[];

  if (auto_draw) {
    const userRow = await queryOne<{ rng_method: string | null }>(
      "SELECT rng_method FROM users WHERE id = $1",
      [userId]
    );
    const rng = await createRng(userRow?.rng_method ?? "math");
    const drawn = drawCards(positions.length, rng);
    cards = positions.map((pos: string, i: number) => ({
      position: pos,
      card_id: drawn[i].id,
      card_name: drawn[i].name,
      reversed: rng() < 0.3,
    }));
  } else if (Array.isArray(manualCards)) {
    const unknown = manualCards.find((c: any) => !getCardById(c?.card_id));
    if (unknown) {
      return Response.json({ error: `Unknown card_id: ${unknown?.card_id}` }, { status: 400 });
    }
    cards = manualCards.map((c: any) => ({
      position: c.position,
      card_id: c.card_id,
      card_name: getCardById(c.card_id)!.name,
      reversed: !!c.reversed,
    }));
  } else {
    return Response.json({ error: "Provide either auto_draw: true or cards[]" }, { status: 400 });
  }

  const prefs = await getPrefs(userId);
  const sky = skyAt(new Date(), { tz: typeof tz === "string" ? tz : null, hemisphere: prefs.hemisphere });

  // The reading and its shared record (lib/divinations.ts) are saved together or not at all.
  const readingId = await withTransaction(async (client) => {
    const { rows } = await client.query(
      "INSERT INTO readings (spread_name, title, question, cards, user_id, sky) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
      [spread_name, title ?? null, question ?? null, JSON.stringify(cards), userId, JSON.stringify(sky)]
    );
    await insertDivination(client, {
      userId,
      kind: "tarot",
      title: title ?? null,
      question: question ?? null,
      summary: tarotSummary(cards),
      sky: JSON.stringify(sky),
      readingId: rows[0].id,
    });
    return rows[0].id as number;
  });

  // Logged the same way as readings made in the app, so they count in Patterns.
  await Promise.all(
    cards.map((card) =>
      logCardDraw({
        userId,
        readingId,
        cardId: card.card_id,
        cardName: card.card_name,
        positionName: card.position,
        spreadName: spread_name,
        reversed: card.reversed,
      })
    )
  );

  const reading = await queryOne("SELECT * FROM readings WHERE id = $1", [readingId]) as any;
  return Response.json({ ...reading, cards: JSON.parse(reading.cards) }, { status: 201 });
}
