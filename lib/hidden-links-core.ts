// A person hiding a shared archetype link for themselves (migration 073, open item R4): the pure parts, with no database
// code, so tests and the browser can use them. lib/hidden-links.ts reads and writes the rows.
//
// Hiding changes nothing for anyone else and nothing in the shared data. For the person it leaves the link off the piece's
// page, off the archetype pages and out of their Patterns counts. A piece the person hid every link of keeps none (the older
// mapping in code does not come back), because that is what they asked for.

import { linksOf, type SymbolLinkRow, type SymbolStore } from "./symbol-links-core";

/** The links a person hid, as "symbol-id|archetype-slug". */
export type HiddenSet = ReadonlySet<string>;

export const NO_HIDDEN: HiddenSet = new Set();

export const hiddenKey = (symbolId: string, slug: string) => `${symbolId}|${slug}`;

/** The links of a piece with the ones this person hid taken out. Same choice between the database and the older mapping as `linksOf`. */
export function visibleLinksOf(store: SymbolStore, hidden: HiddenSet, id: string, fallback: readonly string[]): SymbolLinkRow[] {
  const all = linksOf(store, id, fallback);
  if (hidden.size === 0) return all;
  return all.filter((l) => !hidden.has(hiddenKey(id, l.slug)));
}

/** Most hidden links one person may keep. The shared data has fewer than 1,000 links in all, so this is never reached by hiding real ones. */
export const MAX_HIDDEN = 1500;

/** What the data export holds: the piece and the archetype, by name. */
export interface HiddenExport {
  hidden_shared_links: { piece: string; archetype: string; hidden_on: string }[];
}

export function shapeHiddenExport(rows: { symbol_id: string; archetype: string; created_at: string }[], pieceName: (id: string) => string): HiddenExport {
  return {
    hidden_shared_links: rows.map((r) => ({ piece: pieceName(r.symbol_id), archetype: r.archetype, hidden_on: new Date(r.created_at).toISOString().slice(0, 10) })),
  };
}

/** Markdown lines for the readable export; nothing when the person never hid a link. */
export function hiddenMarkdown(data: HiddenExport): string[] {
  if (data.hidden_shared_links.length === 0) return [];
  const out = ["", "## Shared archetype links you hid", ""];
  for (const h of data.hidden_shared_links) out.push(`- ${h.piece}: ${h.archetype} (hidden ${h.hidden_on})`);
  return out;
}
