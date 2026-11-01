import { NextRequest } from "next/server";
import { formWords, type SetForm } from "@/lib/oracle-forms";
import { query, queryOne, withTransaction } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { createRng } from "@/lib/rng";
import { skyAt } from "@/lib/sky";
import { insertDivination } from "@/lib/divinations";
import { cleanText, loadPull, toId } from "@/lib/oracle";
import { resolveLayout } from "@/lib/layouts";
import { cleanLotCount } from "@/lib/lots-core";
import { jsonBody } from "@/lib/own-http";

// Pulls one card at random from a deck's waking cards and saves the pull. With a layout it pulls one card for each
// position, none twice. The random method is the person's own
// choice (Settings). The card lands upside down only when the deck has reversals on, as often as the deck says.
// Lots from a bag: without a layout, `count` takes that many different items at once (1 to 24, no more than are in the set), and `setAside: true` rests
// every item drawn, so the bag empties until the person puts them back (POST /api/oracle/decks/[id]/wake).
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId;

  const body = await jsonBody(request);
  if (body instanceof Response) return body;
  const deck = await queryOne<{ id: number; name: string; reversals: number; reversal_chance: number; form: SetForm }>(
    "SELECT id, name, reversals, reversal_chance, form FROM oracle_decks WHERE id = $1 AND user_id = $2",
    [toId(body.deck_id), userId]
  );
  if (!deck) return Response.json({ error: "Deck not found" }, { status: 404 });

  // Resting cards are left out of pulls.
  const cards = await query<{ id: number; name: string }>(
    "SELECT id, name FROM oracle_cards WHERE deck_id = $1 AND user_id = $2 AND resting = 0 ORDER BY id ASC",
    [deck.id, userId]
  );
  if (cards.length === 0) return Response.json({ error: `This ${formWords(deck.form).group} has no ${formWords(deck.form).many} to pull` }, { status: 400 });

  const [user, prefs] = await Promise.all([
    queryOne<{ rng_method: string | null }>("SELECT rng_method FROM users WHERE id = $1", [userId]),
    getPrefs(userId),
  ]);
  const rng = await createRng(user?.rng_method ?? "math");
  const chosen = await resolveLayout(userId, body.layoutId, cards.length);
  if (chosen && "error" in chosen) return Response.json({ error: chosen.error }, { status: chosen.status });
  const layout = chosen?.layout ?? null;

  // How many to take: one for each position of a layout, otherwise the number asked for (one when none is asked).
  const wanted = layout ? layout.positions.length : body.count === undefined ? 1 : cleanLotCount(body.count, cards.length);
  if (wanted === null) return Response.json({ error: `count must be a whole number from 1 to ${Math.min(24, cards.length)}` }, { status: 400 });

  // A partial shuffle: each step takes one card out of the ones left, so no card comes up twice.
  const bag = [...cards];
  const picked: { id: number; name: string; reversed: boolean; position: string | null }[] = [];
  for (let i = 0; i < wanted; i++) {
    const [card] = bag.splice(Math.min(bag.length - 1, Math.floor(rng() * bag.length)), 1);
    picked.push({
      id: card.id,
      name: card.name,
      reversed: deck.reversals === 1 && rng() * 100 < deck.reversal_chance,
      position: layout?.positions[i].name ?? null,
    });
  }

  // Snapshot of the sky at the moment of the pull, in the person's own time zone when the browser sent one.
  const sky = skyAt(new Date(), { tz: typeof body.tz === "string" ? body.tz : null, hemisphere: prefs.hemisphere });

  const id = await withTransaction(async (client) => {
    const divinationId = await insertDivination(client, {
      userId,
      kind: "oracle",
      question: cleanText(body.question),
      summary: picked.map((c) => (c.reversed ? `${c.name} (upside down)` : c.name)).join(", "),
      sky: JSON.stringify(sky),
      layoutId: layout?.id ?? null,
      layoutName: layout?.name ?? null,
    });
    await client.query(
      "INSERT INTO oracle_pulls (divination_id, user_id, deck_id, deck_name, deck_form) VALUES ($1, $2, $3, $4, $5)",
      [divinationId, userId, deck.id, deck.name, deck.form]
    );
    await client.query(
      `INSERT INTO oracle_pull_cards (user_id, divination_id, card_id, card_name, reversed, sort_order, position_name)
       SELECT $1, $2, t.card_id, t.card_name, t.reversed, t.ord, t.position_name
       FROM unnest($3::int[], $4::text[], $5::int[], $6::int[], $7::text[])
            AS t(card_id, card_name, reversed, ord, position_name)`,
      [
        userId,
        divinationId,
        picked.map((c) => c.id),
        picked.map((c) => c.name),
        picked.map((c) => (c.reversed ? 1 : 0)),
        picked.map((_, i) => i),
        picked.map((c) => c.position),
      ]
    );
    // Setting aside leaves the drawn items out of the bag, with everything written on them kept, until they are put back.
    if (body.setAside === true) {
      await client.query("UPDATE oracle_cards SET resting = 1 WHERE user_id = $1 AND deck_id = $2 AND id = ANY($3::int[])", [userId, deck.id, picked.map((c) => c.id)]);
    }
    return divinationId;
  });

  return Response.json(await loadPull(userId, id), { status: 201 });
}
