import { conceptQuery, showsSensitive } from "@/lib/concept-visibility";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Return both upright and reversed concepts with a `reversed` flag so the
  // CardWeb component can split them client-side for its polarity toggle.
  const show = await showsSensitive(session.userId);
  const rows = await conceptQuery(
    `SELECT cc.card_id, c.id, c.name, c.display_name, cc.reversed
     FROM card_concepts cc
     JOIN concepts c ON c.id = cc.concept_id
     WHERE {visible}
     ORDER BY cc.card_id, cc.reversed, c.display_name`,
    [],
    show
  ) as any[];

  // Group by card_id
  const map = new Map<string, {
    card_id: string;
    concepts: { id: number; name: string; display_name: string; reversed: boolean }[];
  }>();

  for (const row of rows) {
    if (!map.has(row.card_id)) {
      map.set(row.card_id, { card_id: row.card_id, concepts: [] });
    }
    map.get(row.card_id)!.concepts.push({
      id: row.id,
      name: row.name,
      display_name: row.display_name,
      reversed: row.reversed,
    });
  }

  return Response.json([...map.values()]);
}
