import { NextRequest } from "next/server";
import { queryOne, withTransaction } from "@/lib/db";
import { getSession } from "@/lib/session";
import { toId } from "@/lib/oracle";
import { MAX_SET_ITEMS, namesFromText } from "@/lib/lots-core";

// Adds many items to one of the person's sets at once, from a pasted list with one name to a line. Body: { deck_id, names: "text" }. Each item needs only a
// name, as with a single one. Names that are blank, repeated in the paste, or too long are left out and counted. A set holds at most 1,000 items.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId;

  const body = await request.json().catch(() => null);
  const deck = await queryOne<{ id: number }>("SELECT id FROM oracle_decks WHERE id = $1 AND user_id = $2", [toId(body?.deck_id), userId]);
  if (!deck) return Response.json({ error: "Set not found" }, { status: 404 });

  const parsed = namesFromText(body?.names);
  if (parsed.names.length === 0) return Response.json({ error: "Write at least one name, one to a line." }, { status: 400 });

  const have = await queryOne<{ n: number }>("SELECT COUNT(*)::int AS n FROM oracle_cards WHERE deck_id = $1 AND user_id = $2", [deck.id, userId]);
  const room = MAX_SET_ITEMS - (have?.n ?? 0);
  if (room <= 0) return Response.json({ error: `A set holds at most ${MAX_SET_ITEMS.toLocaleString()} items for now.` }, { status: 400 });
  const names = parsed.names.slice(0, room);

  await withTransaction(async (client) => {
    // The new items go at the end of the set's order, in the order they were written.
    await client.query(
      `INSERT INTO oracle_cards (user_id, deck_id, name, sort_order)
       SELECT $1, $2, t.name, (SELECT COALESCE(MAX(sort_order), -1) FROM oracle_cards WHERE deck_id = $2) + t.ord
       FROM unnest($3::text[]) WITH ORDINALITY AS t(name, ord)`,
      [userId, deck.id, names]
    );
  });

  return Response.json(
    { added: names.length, repeats: parsed.repeats, tooLong: parsed.tooLong, over: parsed.over + (parsed.names.length - names.length) },
    { status: 201 }
  );
}
