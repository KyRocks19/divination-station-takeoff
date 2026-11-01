import { query } from "@/lib/db";
import { conceptQuery, showsSensitive } from "@/lib/concept-visibility";
import { getSession } from "@/lib/session";
import { TAROT_DECK } from "@/lib/cards";

export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const show = await showsSensitive(session.userId);
  const [concepts, edges] = await Promise.all([
    conceptQuery(
      `SELECT c.id, c.name, c.display_name,
              COUNT(cc.card_id)::int AS card_count
       FROM concepts c
       LEFT JOIN card_concepts cc ON cc.concept_id = c.id
       WHERE {visible}
       GROUP BY c.id
       ORDER BY card_count DESC`,
      [],
      show
    ) as Promise<any[]>,
    query("SELECT card_id, concept_id, reversed FROM card_concepts", []) as Promise<any[]>,
  ]);

  // Compute dominant suit per concept from edges (card_id prefix = suit)
  const suitCounts = new Map<number, Record<string, number>>();
  for (const e of edges as any[]) {
    const suit = (e.card_id as string).split("-")[0];
    if (!suitCounts.has(e.concept_id)) suitCounts.set(e.concept_id, {});
    const counts = suitCounts.get(e.concept_id)!;
    counts[suit] = (counts[suit] ?? 0) + 1;
  }

  const conceptsWithSuit = concepts.map((c: any) => {
    const counts = suitCounts.get(c.id) ?? {};
    const dominant_suit = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "major";
    return { id: c.id, name: c.name, display_name: c.display_name, card_count: c.card_count, dominant_suit };
  });

  // Derive card suit from card_id
  const cardIds = new Set(edges.map((e: any) => e.card_id));
  const cards = [...cardIds].map((cid) => {
    const card = TAROT_DECK.find((c) => c.id === cid);
    return { card_id: cid as string, card_name: card?.name ?? cid as string, suit: card?.suit ?? "major" };
  });

  return Response.json({
    concepts: conceptsWithSuit,
    cards,
    edges: edges.map((e: any) => ({ card_id: e.card_id, concept_id: e.concept_id, reversed: e.reversed })),
  });
}
