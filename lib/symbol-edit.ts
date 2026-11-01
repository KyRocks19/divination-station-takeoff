// Writes a stock piece's archetype links (open item R3). Server code only. The caller (the route) has already checked that
// the person is an admin and that the piece is one an admin may edit; the rules for what is allowed in are in
// lib/symbol-edit-core.ts. A change replaces the piece's links and its note in one transaction.

import { withTransaction } from "./db";
import type { StockLinkInput } from "./symbol-edit-core";

export type ReplaceResult = { ok: true; before: number } | { ok: false; error: "missing-archetype" };

export async function replaceStockLinks(symbolId: string, links: StockLinkInput[], note: string): Promise<ReplaceResult> {
  return withTransaction(async (client): Promise<ReplaceResult> => {
    const slugs = links.map((l) => l.slug);
    const { rows } = await client.query<{ id: number; slug: string }>("SELECT id, slug FROM archetypes WHERE slug = ANY($1::text[])", [slugs]);
    const idOf = new Map(rows.map((r) => [r.slug, r.id]));
    if (slugs.some((s) => !idOf.has(s))) return { ok: false, error: "missing-archetype" };

    const { rows: [{ n }] } = await client.query<{ n: string }>("SELECT COUNT(*) AS n FROM symbol_archetypes WHERE symbol_id = $1", [symbolId]);
    await client.query("DELETE FROM symbol_archetypes WHERE symbol_id = $1", [symbolId]);
    await client.query("DELETE FROM symbol_notes WHERE symbol_id = $1", [symbolId]);
    for (const [i, l] of links.entries()) {
      await client.query(
        "INSERT INTO symbol_archetypes (symbol_id, archetype_id, aspect, is_primary, basis, sort_order) VALUES ($1, $2, $3, $4, $5, $6)",
        [symbolId, idOf.get(l.slug), l.aspect, i === 0, l.basis, i]
      );
    }
    if (note) await client.query("INSERT INTO symbol_notes (symbol_id, note) VALUES ($1, $2)", [symbolId, note]);
    return { ok: true, before: Number(n) };
  });
}
