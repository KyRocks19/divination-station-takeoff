// Changing which shared archetypes a piece of a ritual set reaches (open item R3): which pieces an admin may edit, and how
// what comes in is checked. Pure: it imports only the tools' data files, never the database, so the editing screen in the
// browser and the tests can use it. lib/symbol-edit.ts writes the rows.
//
// The pieces are the stock ones that are in symbol_archetypes (migration 059): runes, ogham letters, the coin and every face
// of every die, the five starting pendulum swings and the scrying surfaces. A tarot card's archetypes are still read from its
// concepts (item R1), and a pendulum line a person adds has no shared archetypes on purpose, so neither is editable here.

import { ARCHETYPES } from "./archetypes-data";
import { PENDULUM_MEANINGS, SCRYING_MEANINGS } from "./common-meanings-data";
import { DICE_OBJECTS, facesOf, faceId } from "./dice-data";
import { STAVES } from "./ogham-data";
import { symbolLabel } from "./piece-labels";
import { RUNES } from "./runes-data";
import { BASIS_KEYS, type Basis } from "./symbol-archetype-map";

import { MAX_STOCK_LINKS, MAX_STOCK_NOTE, type StockAspect, type StockPiece } from "./symbol-edit-shared";

export { MAX_STOCK_LINKS, MAX_STOCK_NOTE };
export type { StockAspect, StockPiece };

let cache: StockPiece[] | null = null;

/** Every stock piece an admin may edit, grouped and in the tool's own order. */
export function stockPieces(): StockPiece[] {
  if (cache) return cache;
  const out: StockPiece[] = [];
  const add = (id: string, group: string) => out.push({ id, name: symbolLabel(id)?.name ?? id, group });
  for (const r of RUNES) add(r.id, "Runes");
  for (const s of STAVES) add(s.id, "Ogham");
  // A knucklebone has no shared archetype links to edit; the person's own words are all there is for its sides.
  for (const o of DICE_OBJECTS) if (!o.plainSides) for (const f of facesOf(o.id)) add(faceId(o.id, f), o.id === "coin" ? "Coin" : `Dice: ${o.id}`);
  for (const id of Object.keys(PENDULUM_MEANINGS)) add(id, "Pendulum");
  for (const id of Object.keys(SCRYING_MEANINGS)) add(id, "Scrying");
  cache = out;
  return out;
}

export function isStockPiece(id: string): boolean {
  return stockPieces().some((p) => p.id === id);
}

export interface StockLinkInput {
  slug: string;
  aspect: StockAspect;
  basis: Basis;
}

export type CleanedStockLinks = { ok: true; links: StockLinkInput[]; note: string } | { ok: false; error: string };

const ASPECTS: StockAspect[] = ["light", "shadow", "neutral"];

/**
 * Checks a piece's new links and note. The first link is the piece's primary archetype. Every link names a real
 * archetype, a side, and what it was drawn from; no archetype is listed twice; a piece with no archetype needs a note
 * saying why, so that it reads as a decision and not a gap.
 */
export function cleanStockLinks(body: unknown): CleanedStockLinks {
  const raw = body as { links?: unknown; note?: unknown } | null;
  if (!raw || !Array.isArray(raw.links)) return { ok: false, error: "links must be a list" };
  if (raw.links.length > MAX_STOCK_LINKS) return { ok: false, error: `A piece can reach at most ${MAX_STOCK_LINKS} archetypes` };
  const known = new Set(ARCHETYPES.map((a) => a.slug));
  const seen = new Set<string>();
  const links: StockLinkInput[] = [];
  for (const item of raw.links as unknown[]) {
    const l = item as { slug?: unknown; aspect?: unknown; basis?: unknown } | null;
    if (!l || typeof l.slug !== "string" || !known.has(l.slug)) return { ok: false, error: "One of the archetypes is not one the app has" };
    if (seen.has(l.slug)) return { ok: false, error: "An archetype is listed twice" };
    seen.add(l.slug);
    if (typeof l.aspect !== "string" || !ASPECTS.includes(l.aspect as StockAspect)) return { ok: false, error: "Each link needs a side" };
    if (typeof l.basis !== "string" || !BASIS_KEYS.includes(l.basis as Basis)) return { ok: false, error: "Each link needs what it was drawn from" };
    links.push({ slug: l.slug, aspect: l.aspect as StockAspect, basis: l.basis as Basis });
  }
  if (raw.note !== undefined && raw.note !== null && typeof raw.note !== "string") return { ok: false, error: "The note must be text" };
  const note = ((raw.note as string | null | undefined) ?? "").replace(/\s+/g, " ").trim();
  if (note.length > MAX_STOCK_NOTE) return { ok: false, error: `The note can be at most ${MAX_STOCK_NOTE} characters` };
  if (links.length === 0 && !note) return { ok: false, error: "A piece with no archetype needs a note saying why" };
  return { ok: true, links, note };
}
