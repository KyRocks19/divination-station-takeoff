// Reading the links between pieces of a ritual set and the shared archetypes, without any database code: the shape of
// a link, how a piece's links are chosen between the database and the older mapping in code, and which side of an
// archetype a draw touches. lib/symbol-links.ts loads the database half. Tests cover this file directly.

import type { Aspect } from "./archetypes-data";

export interface SymbolLinkRow {
  slug: string;
  aspect: Aspect;
  /** What the link was drawn from (see BASES in lib/symbol-archetype-map.ts), or null for the older mapping in code, which does not say. */
  basis: string | null;
  primary: boolean;
}

/** What the database holds: each piece's links in order, and which pieces it has a record of at all. */
export interface SymbolStore {
  links: Map<string, SymbolLinkRow[]>;
  /** Pieces with a row in symbol_archetypes or symbol_notes. A recorded piece with no links has none on purpose. */
  recorded: Set<string>;
  /** The short note kept with a piece: how its links were reached, or why it has none. */
  notes: Map<string, string>;
}

export const EMPTY_STORE: SymbolStore = { links: new Map(), recorded: new Set(), notes: new Map() };

/**
 * The links of one piece. The database wins for any piece it has a record of (even a record of none, such as the later
 * ogham letters, or a piece an admin emptied on purpose); a piece it knows nothing of keeps the older mapping in code,
 * so a tool not seeded yet behaves as it always did.
 */
export function linksOf(store: SymbolStore, id: string, fallback: readonly string[]): SymbolLinkRow[] {
  const rows = store.links.get(id);
  if (rows && rows.length > 0) return rows;
  if (store.recorded.has(id)) return [];
  return fallback.map((slug, i) => ({ slug, aspect: "neutral" as Aspect, basis: null, primary: i === 0 }));
}

export type Side = "light" | "shadow" | "either";

/**
 * Which side of an archetype a draw touches. A piece turned upside down (a rune) is on the hard side, since that is what
 * turning it over is for in modern use. Otherwise the link's own side counts: a link that names the hard side (a warning
 * in a poem) is shadow, one that names the good side is light, and the rest, which is most of them, are either.
 */
export function sideOf(link: Pick<SymbolLinkRow, "aspect">, reversed: boolean): Side {
  if (reversed) return "shadow";
  if (link.aspect === "shadow") return "shadow";
  if (link.aspect === "light") return "light";
  return "either";
}

/** Short names for the bases, for a small label beside a symbol. Full wording is BASES in lib/symbol-archetype-map.ts. */
export const BASIS_LABELS: Record<string, string> = {
  poem: "old poem",
  name: "its name",
  gloss: "medieval gloss",
  myth: "a story",
  folk: "folk lore",
  modern: "modern practice",
  "smith-waite": "Pixie-Smith",
  numerology: "its number",
  number: "its number",
  suit: "its suit",
  encyclopedia: "the encyclopedia",
  app: "this app's reading",
};
