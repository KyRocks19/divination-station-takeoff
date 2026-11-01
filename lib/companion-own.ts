import { query } from "./db";

// The person's own archetypes and concepts that they linked a piece to, for what the AI companion is told. Only words the
// person wrote: the name they gave it and what they wrote about it (an archetype's summary and its good and hard sides, a
// concept's description). A link to one of the app's shared archetypes is NOT read here: its words are the app's, not the
// person's, and nothing of the app's is ever sent (tests/companion-context.test.ts checks it). This file imports only the
// database, so none of the stock archetype texts can reach the model through it.

export interface ContextOwnLink {
  kind: "archetype" | "concept";
  /** The name the person gave it. */
  name: string;
  /** What the person wrote about it, each part already labelled in their own terms. Empty when they wrote nothing. */
  words: string[];
  /** The side of it they linked this piece to. */
  side: "light" | "shadow" | "neutral";
}

export interface OwnLinkMaps {
  bySymbol: Map<string, ContextOwnLink[]>;
  byOracleCard: Map<number, ContextOwnLink[]>;
}

const EMPTY = (): OwnLinkMaps => ({ bySymbol: new Map(), byOracleCard: new Map() });

/** The person's own links from these pieces (shared piece ids, and their own oracle items by id). */
export async function ownLinksFor(userId: number, symbolIds: string[], oracleCardIds: number[]): Promise<OwnLinkMaps> {
  const out = EMPTY();
  if (symbolIds.length === 0 && oracleCardIds.length === 0) return out;
  const rows = await query<{
    symbol_id: string | null; oracle_card_id: number | null; aspect: "light" | "shadow" | "neutral";
    ua_name: string | null; summary: string | null; light: string | null; shadow: string | null; uc_name: string | null; description: string | null;
  }>(
    `SELECT l.symbol_id, l.oracle_card_id, l.aspect,
            ua.name AS ua_name, ua.summary, ua.light, ua.shadow, uc.name AS uc_name, uc.description
       FROM user_symbol_links l
       LEFT JOIN user_archetypes ua ON ua.id = l.user_archetype_id AND ua.user_id = l.user_id
       LEFT JOIN user_concepts uc ON uc.id = l.user_concept_id AND uc.user_id = l.user_id
      WHERE l.user_id = $1 AND l.archetype_id IS NULL
        AND (l.symbol_id = ANY($2) OR l.oracle_card_id = ANY($3))
      ORDER BY l.id`,
    [userId, symbolIds, oracleCardIds]
  );
  for (const r of rows) {
    const link: ContextOwnLink | null = r.ua_name
      ? {
          kind: "archetype",
          name: r.ua_name,
          side: r.aspect,
          words: [
            r.summary?.trim() ? r.summary.trim() : "",
            r.light?.trim() ? `when it goes well: ${r.light.trim()}` : "",
            r.shadow?.trim() ? `when it is hard: ${r.shadow.trim()}` : "",
          ].filter(Boolean),
        }
      : r.uc_name
        ? { kind: "concept", name: r.uc_name, side: r.aspect, words: r.description?.trim() ? [r.description.trim()] : [] }
        : null;
    if (!link) continue;
    if (r.symbol_id) out.bySymbol.set(r.symbol_id, [...(out.bySymbol.get(r.symbol_id) ?? []), link]);
    if (r.oracle_card_id) out.byOracleCard.set(r.oracle_card_id, [...(out.byOracleCard.get(r.oracle_card_id) ?? []), link]);
  }
  return out;
}
