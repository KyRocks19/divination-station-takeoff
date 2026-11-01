import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { conceptQuery, showsSensitive } from "@/lib/concept-visibility";
import { getSession } from "@/lib/session";
import { effectiveRealm } from "@/lib/concept-realm-core";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const polarity = req.nextUrl.searchParams.get("polarity"); // "upright" | "reversed" | null

  const show = await showsSensitive(session.userId);
  const [rows, edges] = await Promise.all([
    conceptQuery(
      `SELECT c.id, c.name, c.display_name, {aliases} AS aliases,
              c.realm                                                      AS own_realm,
              (SELECT a.realm FROM concept_archetypes ca JOIN archetypes a ON a.id = ca.archetype_id
                WHERE ca.concept_id = c.id AND ca.is_primary LIMIT 1)      AS archetype_realm,
              COUNT(cc.card_id)::int                                       AS card_count,
              COUNT(CASE WHEN cc.reversed = false THEN 1 END)::int         AS upright_count,
              COUNT(CASE WHEN cc.reversed = true  THEN 1 END)::int         AS reversed_count
       FROM concepts c
       LEFT JOIN card_concepts cc ON cc.concept_id = c.id
       WHERE {visible}
       GROUP BY c.id
       ORDER BY c.display_name ASC`,
      [],
      show
    ) as Promise<any[]>,
    query("SELECT card_id, concept_id FROM card_concepts", []) as Promise<any[]>,
  ]);

  // Dominant suit derived from all edges (upright + reversed)
  const suitCounts = new Map<number, Record<string, number>>();
  for (const e of edges as any[]) {
    const suit = (e.card_id as string).split("-")[0];
    if (!suitCounts.has(e.concept_id)) suitCounts.set(e.concept_id, {});
    const counts = suitCounts.get(e.concept_id)!;
    counts[suit] = (counts[suit] ?? 0) + 1;
  }

  let result = (rows as any[]).map(({ own_realm, archetype_realm, ...c }) => {
    const counts = suitCounts.get(c.id) ?? {};
    const dominant_suit = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "major";
    return { ...c, dominant_suit, realm: effectiveRealm(own_realm, archetype_realm) };
  });

  if (polarity === "upright") {
    result = result.filter((c) => c.upright_count > 0);
  } else if (polarity === "reversed") {
    result = result.filter((c) => c.reversed_count > 0);
  }

  return Response.json(result);
}
