// Loads the links between pieces of a ritual set and the shared archetypes from the database (migration 059).
// Server code only: it imports the database. How a piece's links are chosen is in lib/symbol-links-core.ts.

import { query } from "@/lib/db";
import type { Aspect } from "@/lib/archetypes-data";
import type { SymbolLinkRow, SymbolStore } from "@/lib/symbol-links-core";

/** Every piece's links, in order, and which pieces the database has a record of. A piece with no record falls back to the mapping in code. */
export async function loadSymbolStore(): Promise<SymbolStore> {
  const [rows, noted] = await Promise.all([
    query<{ symbol_id: string; slug: string; aspect: Aspect; basis: string; is_primary: boolean }>(
      `SELECT s.symbol_id, a.slug, s.aspect, s.basis, s.is_primary
         FROM symbol_archetypes s JOIN archetypes a ON a.id = s.archetype_id
        ORDER BY s.symbol_id, s.sort_order`
    ),
    query<{ symbol_id: string; note: string }>("SELECT symbol_id, note FROM symbol_notes"),
  ]);
  const links = new Map<string, SymbolLinkRow[]>();
  const recorded = new Set<string>(noted.map((r) => r.symbol_id));
  const notes = new Map<string, string>(noted.map((r) => [r.symbol_id, r.note]));
  for (const r of rows) {
    recorded.add(r.symbol_id);
    const list = links.get(r.symbol_id) ?? [];
    list.push({ slug: r.slug, aspect: r.aspect, basis: r.basis, primary: r.is_primary });
    links.set(r.symbol_id, list);
  }
  return { links, recorded, notes };
}
