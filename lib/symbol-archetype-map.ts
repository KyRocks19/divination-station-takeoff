// The hand-written files that say which archetypes each piece of a ritual set (a rune, an ogham letter, later the
// others) reaches, and what each link was drawn from. This file only reads and checks that text: it touches no database
// code and no files, so the browser could import it, and tests and the seed script share one reader.
//
// Format of a data file (data/symbol-archetypes-*.txt), one piece per line:
//   piece-id | slug[:aspect]=basis, slug[:aspect]=basis, ... | note
//   piece-id | - | note                      (deliberately no archetype; the note says why)
// - The first link on a line is the piece's primary archetype.
// - aspect is light, shadow or either; left off it means either. A shadow link is one the source gives for the hard
//   side (a warning in a poem, for example).
// - basis says what the link was drawn from (BASES below). It is never left out.
// - Lines starting with "@basis NAME = id, id" name the sources (ids from lib/sources.ts) that stand behind a basis.
// - Lines starting with # are comments.

import type { Aspect } from "./archetypes-data";

/**
 * What a link was drawn from. Age is information, not rank: modern practice is as valid as old, and the label only says
 * which is which, so a person knows what they are reading.
 */
export const BASES = {
  poem: "A verse of an old rune poem (8th to 15th century) speaks to the theme.",
  name: "The meaning of the piece's own name: a rune's or letter's as scholars reconstruct it, a hexagram's or geomantic figure's as it is usually translated.",
  gloss: "A medieval gloss or commentary on the letter (the tree names, the poetic kennings).",
  myth: "A story of the gods or heroes that the symbol is tied to.",
  folk: "Traditional plant or folk lore that is attested, though not in the poems or glosses.",
  modern: "Modern divination practice (for runes mostly Ralph Blum 1982 and later; for ogham mostly Robert Graves 1948 and later). Authors differ.",
  "smith-waite": "The card's Pixie-Smith keywords and text, as written in this app, speak to the theme. They follow modern reading practice more than Waite's 1910 book, and authors differ.",
  numerology: "The card's number, as read in modern tarot numerology: an Ace begins, a Two pairs or chooses, a Five tests, a Ten completes. Tarot numerology is modern practice.",
  number: "The number's usual reading in modern numerology and in how tarot reads its number cards. Both are modern practice in their current form, and no old source gives a meaning for a face of a die.",
  suit: "The suit's usual association: Cups with feeling, Pentacles with the material world, Swords with thought and conflict, Wands with energy and drive (from the Golden Dawn and Waite, then modern practice).",
  encyclopedia: "Most of the card's concepts in the app's encyclopedia (from the St. Cepesa Horat data) sit under this archetype, though the card's keywords do not say it outright.",
  app: "This app's own reading, with no source behind it. Kept so nothing is lost, and open to being dropped.",
} as const;

export type Basis = keyof typeof BASES;
export const BASIS_KEYS = Object.keys(BASES) as Basis[];

export interface SymbolLink {
  slug: string;
  aspect: Aspect;
  basis: Basis;
  primary: boolean;
}

export interface SymbolEntry {
  id: string;
  links: SymbolLink[];
  note: string;
}

export interface ParsedMap {
  entries: SymbolEntry[];
  /** From "@basis" lines: the source ids behind each basis in this file. */
  sources: Partial<Record<Basis, string[]>>;
  /** Problems with the text itself (never thrown, so a test can print them all). */
  problems: string[];
}

const ASPECTS: Aspect[] = ["light", "shadow", "neutral"];

/** Reads one data file. "either" in the text is stored as "neutral", the word the database uses. */
export function parseSymbolArchetypeFile(text: string): ParsedMap {
  const entries: SymbolEntry[] = [];
  const sources: ParsedMap["sources"] = {};
  const problems: string[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((raw, i) => {
    const where = `line ${i + 1}`;
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    if (line.startsWith("@basis")) {
      const m = line.match(/^@basis\s+([\w-]+)\s*=\s*(.*)$/);
      if (!m || !BASIS_KEYS.includes(m[1] as Basis)) {
        problems.push(`${where}: unreadable @basis line`);
        return;
      }
      sources[m[1] as Basis] = m[2].split(",").map((s) => s.trim()).filter(Boolean);
      return;
    }
    const parts = line.split(" | ");
    if (parts.length < 2) {
      problems.push(`${where}: expected "id | links | note"`);
      return;
    }
    const id = parts[0].trim();
    const note = parts.slice(2).join(" | ").trim();
    const linkText = parts[1].trim();
    const links: SymbolLink[] = [];
    if (linkText !== "-") {
      for (const chunk of linkText.split(",")) {
        const m = chunk.trim().match(/^([a-z-]+)(?::(light|shadow|either))?=([\w-]+)$/);
        if (!m) {
          problems.push(`${where}: unreadable link "${chunk.trim()}"`);
          continue;
        }
        const basis = m[3] as Basis;
        if (!BASIS_KEYS.includes(basis)) {
          problems.push(`${where}: unknown basis "${m[3]}" on ${m[1]}`);
          continue;
        }
        const aspect = (m[2] === "either" || !m[2] ? "neutral" : m[2]) as Aspect;
        if (!ASPECTS.includes(aspect)) problems.push(`${where}: unknown aspect on ${m[1]}`);
        links.push({ slug: m[1], aspect, basis, primary: links.length === 0 });
      }
    }
    entries.push({ id, links, note });
  });
  return { entries, sources, problems };
}

/**
 * Checks a parsed map against the pieces the app has and the archetypes it knows. Returns every problem found.
 * `mustCover` is the ids of all the pieces; `known` the archetype slugs; `sourceIds` the ids in lib/sources.ts.
 */
export function checkSymbolMap(
  map: ParsedMap,
  mustCover: string[],
  known: Set<string>,
  sourceIds: Set<string>
): string[] {
  const out = [...map.problems];
  const seen = new Set<string>();
  for (const e of map.entries) {
    if (seen.has(e.id)) out.push(`${e.id}: listed twice`);
    seen.add(e.id);
    if (!mustCover.includes(e.id)) out.push(`${e.id}: not a piece of this set`);
    const slugs = new Set<string>();
    for (const l of e.links) {
      if (!known.has(l.slug)) out.push(`${e.id}: "${l.slug}" is not an archetype`);
      if (slugs.has(l.slug)) out.push(`${e.id}: "${l.slug}" listed twice`);
      slugs.add(l.slug);
    }
    if (e.links.length === 0 && !e.note) out.push(`${e.id}: no archetype and no note saying why`);
  }
  for (const id of mustCover) if (!seen.has(id)) out.push(`${id}: missing from the file`);
  for (const [basis, ids] of Object.entries(map.sources)) {
    for (const id of ids ?? []) if (!sourceIds.has(id)) out.push(`@basis ${basis}: "${id}" is not a source in lib/sources.ts`);
  }
  return out;
}
