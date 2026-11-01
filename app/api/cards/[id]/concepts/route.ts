import { NextRequest } from "next/server";
import { conceptQuery, showsSensitive, withheldOnCard } from "@/lib/concept-visibility";
import { getSession } from "@/lib/session";
import { TAROT_DECK } from "@/lib/cards";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!TAROT_DECK.find((c) => c.id === id)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Concepts marked sensitive are held back unless this person turned "Show sensitive meanings" on; hidden ones are never sent.
  const show = await showsSensitive(session.userId);

  // card_count = total cards that share this concept (across all polarities)
  const rows = await conceptQuery<{ id: number; name: string; display_name: string; reversed: boolean; card_count: number }>(
    `SELECT c.id, c.name, c.display_name,
            cc.reversed,
            COUNT(cc2.card_id)::int AS card_count
     FROM concepts c
     JOIN card_concepts cc  ON cc.concept_id = c.id AND cc.card_id = $1
     LEFT JOIN card_concepts cc2 ON cc2.concept_id = c.id
     WHERE {visible}
     GROUP BY c.id, cc.reversed
     ORDER BY c.display_name ASC`,
    [id],
    show
  );

  return Response.json({
    upright:  rows.filter((r) => !r.reversed),
    reversed: rows.filter((r) =>  r.reversed),
    // How many of this card's concepts are sensitive, and whether this person is seeing them.
    sensitive: await withheldOnCard(id),
    showing: show,
  });
}
