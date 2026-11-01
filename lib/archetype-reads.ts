// Reads for the Archetypes pages: which symbols from which tools touch an archetype, and which tarot cards and concepts
// do (from the database). A symbol's links come from the database (migration 059, symbol_archetypes) where it has a record
// there, and from the older mapping in code where it does not (see lib/symbol-links-core.ts). Server code only: it imports
// the database.

import { query } from "@/lib/db";
import { conceptQuery } from "./concept-visibility";
import { ARCHETYPES, getArchetype, type Aspect } from "@/lib/archetypes-data";
import {
  COIN_MEANINGS, OGHAM_MEANINGS, PENDULUM_MEANINGS, RUNE_MEANINGS, SCRYING_MEANINGS, numberMeaning,
  type CommonMeaning, type ToolKey,
} from "@/lib/common-meanings-data";
import { RUNES } from "@/lib/runes-data";
import { STAVES } from "@/lib/ogham-data";
import { DICE_OBJECTS, faceId, isNumbered } from "@/lib/dice-data";
import { SCRYING_SURFACE_LABELS } from "@/lib/scrying-surfaces";
import { TAROT_DECK } from "@/lib/cards";
import { loadSymbolStore } from "@/lib/symbol-links";
import type { SymbolLinkRow } from "@/lib/symbol-links-core";
import { NO_HIDDEN, visibleLinksOf, type HiddenSet } from "@/lib/hidden-links-core";
import { loadHidden } from "@/lib/hidden-links";

export interface ToolSymbol {
  tool: ToolKey;
  /** The tool's name for display. */
  toolName: string;
  name: string;
  href: string;
  keywords: string;
  /** What this symbol's link to the archetype was drawn from, or null where it is not recorded (the older mapping in code). */
  basis: string | null;
  /** The side of the archetype the link names. */
  aspect: "light" | "shadow" | "neutral";
}

const PENDULUM_NAMES: Record<string, string> = {
  "swing-line-0": "Back and forth",
  "swing-line-90": "Side to side",
  "swing-circle_cw": "Circle clockwise",
  "swing-circle_ccw": "Circle counter-clockwise",
  "swing-still": "Still",
};

type SymbolWithLinks = { symbol: Omit<ToolSymbol, "basis" | "aspect">; links: SymbolLinkRow[] };

/** Every symbol of every non-tarot tool that has a common meaning, with the archetypes it touches. */
async function allSymbols(hidden: HiddenSet = NO_HIDDEN): Promise<SymbolWithLinks[]> {
  const store = await loadSymbolStore();
  const out: SymbolWithLinks[] = [];
  const add = (id: string, s: SymbolWithLinks["symbol"], m: CommonMeaning) => out.push({ symbol: s, links: visibleLinksOf(store, hidden, id, m.archetypes) });
  for (const r of RUNES) {
    const m = RUNE_MEANINGS[r.id];
    if (m) add(r.id, { tool: "rune", toolName: "Runes", name: r.name, href: `/runes/set/${r.id}`, keywords: m.keywords }, m);
  }
  for (const s of STAVES) {
    const m = OGHAM_MEANINGS[s.id];
    if (m) add(s.id, { tool: "ogham", toolName: "Ogham", name: s.name, href: `/ogham/set/${s.id}`, keywords: m.keywords }, m);
  }
  // A letter the database has a record of but no common meaning in code (a later ogham letter with a link someone added).
  for (const s of STAVES) {
    if (OGHAM_MEANINGS[s.id]) continue;
    const links = visibleLinksOf(store, hidden, s.id, []);
    if (links.length) out.push({ symbol: { tool: "ogham", toolName: "Ogham", name: s.name, href: `/ogham/set/${s.id}`, keywords: "" }, links });
  }
  for (const [id, m] of Object.entries(COIN_MEANINGS)) {
    const face = id.replace("coin-", "");
    add(id, { tool: "coin", toolName: "Coin", name: face === "heads" ? "Heads" : "Tails", href: `/dice/set/coin/${face}`, keywords: m.keywords }, m);
  }
  for (const obj of DICE_OBJECTS) {
    // The coin has its own meanings above; a knucklebone has no number meanings or shared links at all.
    if (!isNumbered(obj.id)) continue;
    // Only the first 12 faces are listed one by one; faces above that are the same archetypes carried further.
    for (let n = 1; n <= Math.min(obj.faces, 12); n++) {
      const m = numberMeaning(n, obj.faces);
      add(faceId(obj.id, String(n)), { tool: "number", toolName: `Dice (${obj.id})`, name: `${obj.id} · ${n}`, href: `/dice/set/${obj.id}/${n}`, keywords: m.keywords }, m);
    }
  }
  for (const [id, m] of Object.entries(PENDULUM_MEANINGS)) {
    add(id, { tool: "pendulum", toolName: "Pendulum", name: PENDULUM_NAMES[id] ?? id, href: "/pendulum/swings", keywords: m.keywords }, m);
  }
  for (const [id, m] of Object.entries(SCRYING_MEANINGS)) {
    const key = id.replace("scrying-", "") as keyof typeof SCRYING_SURFACE_LABELS;
    add(id, { tool: "scrying", toolName: "Scrying", name: SCRYING_SURFACE_LABELS[key] ?? id, href: "/scrying/new", keywords: m.keywords }, m);
  }
  return out;
}

/** The symbols from the other tools that touch an archetype, with what each link was drawn from. Links this person hid are left out. */
export async function symbolsForArchetype(slug: string, userId?: number): Promise<ToolSymbol[]> {
  const out: ToolSymbol[] = [];
  for (const x of await allSymbols(userId ? await loadHidden(userId) : NO_HIDDEN)) {
    const link = x.links.find((l) => l.slug === slug);
    if (link) out.push({ ...x.symbol, basis: link.basis, aspect: link.aspect });
  }
  return out;
}

/** How many symbols from the other tools touch each archetype (not counting links this person hid). */
export async function symbolCounts(userId?: number): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const x of await allSymbols(userId ? await loadHidden(userId) : NO_HIDDEN)) for (const l of x.links) out[l.slug] = (out[l.slug] ?? 0) + 1;
  return out;
}

/** How many tarot concepts sit under each archetype (as their first archetype). */
export async function conceptCounts(): Promise<Record<string, number>> {
  const rows = await query<{ slug: string; n: string }>(
    `SELECT a.slug, COUNT(*) AS n FROM concept_archetypes ca JOIN archetypes a ON a.id = ca.archetype_id
     WHERE ca.is_primary GROUP BY a.slug`
  );
  return Object.fromEntries(rows.map((r) => [r.slug, Number(r.n)]));
}

export interface ArchetypeConcept { id: number; name: string; display_name: string; aspect: Aspect }
export interface ArchetypeCard { id: string; name: string; light: number; shadow: number }

/** The tarot concepts under an archetype and the cards that carry them most. */
export async function tarotForArchetype(slug: string, showSensitive = false): Promise<{ concepts: ArchetypeConcept[]; cards: ArchetypeCard[] }> {
  if (!getArchetype(slug)) return { concepts: [], cards: [] };
  const concepts = await conceptQuery<ArchetypeConcept>(
    `SELECT c.id, c.name, c.display_name, ca.aspect
       FROM concept_archetypes ca
       JOIN archetypes a ON a.id = ca.archetype_id AND a.slug = $1
       JOIN concepts c ON c.id = ca.concept_id
      WHERE {visible}
      ORDER BY ca.aspect, c.display_name`,
    [slug],
    showSensitive
  );
  const rows = await query<{ card_id: string; aspect: Aspect; n: string }>(
    `SELECT cc.card_id, ca.aspect, COUNT(DISTINCT cc.concept_id) AS n
       FROM card_concepts cc
       JOIN concept_archetypes ca ON ca.concept_id = cc.concept_id
       JOIN archetypes a ON a.id = ca.archetype_id AND a.slug = $1
      GROUP BY cc.card_id, ca.aspect`,
    [slug]
  );
  const byCard = new Map<string, ArchetypeCard>();
  for (const r of rows) {
    const card = TAROT_DECK.find((c) => c.id === r.card_id);
    if (!card) continue;
    const e = byCard.get(r.card_id) ?? { id: r.card_id, name: card.name, light: 0, shadow: 0 };
    if (r.aspect === "shadow") e.shadow += Number(r.n); else e.light += Number(r.n);
    byCard.set(r.card_id, e);
  }
  const cards = [...byCard.values()].sort((a, b) => b.light + b.shadow - (a.light + a.shadow)).slice(0, 12);
  return { concepts, cards };
}

export { ARCHETYPES };
