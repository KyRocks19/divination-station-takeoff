import { NextRequest } from "next/server";
import { query, queryOne, logCardDraw, withTransaction } from "@/lib/db";
import { insertDivination, tarotSummary } from "@/lib/divinations";
import { getSession } from "@/lib/session";
import { clip, firstOf, tooLong } from "@/lib/limits";
import { getPrefs } from "@/lib/prefs";
import { skyAt } from "@/lib/sky";
import { jsonBody } from "@/lib/own-http";
import { markOwnDraw } from "@/lib/own-draw";

export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const readings = await query(
    "SELECT * FROM readings WHERE user_id = $1 ORDER BY created_at DESC",
    [session.userId!]
  );
  return Response.json(readings.map((r: any) => ({ ...r, cards: JSON.parse(r.cards) })));
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const sent = await jsonBody(request);
  if (sent instanceof Response) return sent;
  const { spread_id, layout_id, spread_name, title, question, cards, notes, tz, own_draw } = sent;
  if (!spread_name || !Array.isArray(cards)) {
    return Response.json({ error: "spread_name and cards are required" }, { status: 400 });
  }

  if (tooLong(title, 300) || tooLong(question, 2000) || tooLong(notes, 20000) || cards.length > 120) {
    return Response.json({ error: "That reading is too long to save" }, { status: 400 });
  }
  // A spread is the person's own or one of the presets; another person's spread id is ignored.
  let spreadId: number | null = null;
  if (spread_id !== undefined && spread_id !== null && spread_id !== "") {
    const spread = await queryOne<{ id: number }>("SELECT id FROM spreads WHERE id = $1 AND (user_id = $2 OR is_preset = 1)", [Number(spread_id) || 0, session.userId!]);
    spreadId = spread?.id ?? null;
  }

  // A reading made with one of the person's layouts remembers it (the name stays as written if the layout is deleted).
  let layoutId: number | null = null;
  if (layout_id !== undefined && layout_id !== null && layout_id !== "") {
    const owned = await queryOne<{ id: number }>("SELECT id FROM layouts WHERE id = $1 AND user_id = $2", [Number(layout_id), session.userId!]);
    if (!owned) return Response.json({ error: "Layout not found" }, { status: 404 });
    layoutId = owned.id;
  }

  // Snapshot of the sky at the moment of the reading, in the user's own time zone when the browser sent one.
  const prefs = await getPrefs(session.userId);
  const sky = skyAt(new Date(), { tz: typeof tz === "string" ? tz : null, hemisphere: prefs.hemisphere });

  // The reading and its shared record (lib/divinations.ts) are saved together or not at all.
  const readingId = await withTransaction(async (client) => {
    const { rows } = await client.query(
      "INSERT INTO readings (user_id, spread_id, layout_id, spread_name, title, question, cards, notes, sky) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id",
      [session.userId!, spreadId, layoutId, clip(spread_name, 200), title ?? null, question ?? null, JSON.stringify(cards), notes ?? null, JSON.stringify(sky)]
    );
    await insertDivination(client, {
      userId: session.userId!,
      kind: "tarot",
      title: title ?? null,
      question: question ?? null,
      summary: tarotSummary(cards),
      sky: JSON.stringify(sky),
      readingId: rows[0].id,
      layoutId,
      layoutName: layoutId ? spread_name : null,
    });
    // Cards the person drew with their own deck and entered here: the reading opens at once (lib/own-draw.ts).
    if (own_draw === true) await markOwnDraw(client, [rows[0].id]);
    return rows[0].id as number;
  });

  await Promise.all(
    cards.map((card: any) =>
      logCardDraw({
        userId: session.userId!,
        readingId,
        cardId: card.card_id,
        cardName: card.card_name,
        positionName: card.position,
        spreadName: spread_name,
        reversed: card.reversed ?? false,
      })
    )
  );

  const reading = await queryOne("SELECT * FROM readings WHERE id = $1", [readingId]) as any;
  return Response.json({ ...reading, cards: JSON.parse(reading.cards) }, { status: 201 });
}
