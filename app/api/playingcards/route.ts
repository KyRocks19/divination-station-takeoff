import { NextRequest } from "next/server";
import { queryOne, withTransaction } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { createRng } from "@/lib/rng";
import { skyAt } from "@/lib/sky";
import { insertDivination } from "@/lib/divinations";
import { cleanText } from "@/lib/oracle";
import { cleanDrawCount, drawCards, drawSummary, listDraws, loadDraw } from "@/lib/playingcards";

// The person's draws, newest first.
export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await listDraws(session.userId));
}

// Draws cards from a 52-card pack and saves the reading at once. Body: { count: 1 to 10, question?, tz? }. The app picks with the random method the person
// chose in Settings; no card comes up twice in one draw.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId;

  const body = await request.json().catch(() => null);
  const count = cleanDrawCount(body?.count ?? 1);
  if (count === null) return Response.json({ error: "count must be a whole number from 1 to 10" }, { status: 400 });

  const [user, prefs] = await Promise.all([
    queryOne<{ rng_method: string | null }>("SELECT rng_method FROM users WHERE id = $1", [userId]),
    getPrefs(userId),
  ]);
  const rng = await createRng(user?.rng_method ?? "math");
  const cards = drawCards(count, rng);
  const sky = skyAt(new Date(), { tz: typeof body?.tz === "string" ? body.tz : null, hemisphere: prefs.hemisphere });

  const id = await withTransaction(async (client) => {
    const divinationId = await insertDivination(client, {
      userId,
      kind: "playingcards",
      question: cleanText(body?.question),
      summary: drawSummary(cards.map((c) => ({ card_name: c.name }))),
      sky: JSON.stringify(sky),
    });
    for (const [i, c] of cards.entries()) {
      await client.query(
        "INSERT INTO playing_card_draws (user_id, divination_id, sort_order, card_id, card_name) VALUES ($1, $2, $3, $4, $5)",
        [userId, divinationId, i, c.id, c.name]
      );
    }
    return divinationId;
  });

  return Response.json(await loadDraw(userId, id), { status: 201 });
}
