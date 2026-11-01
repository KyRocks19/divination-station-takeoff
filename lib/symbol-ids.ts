// Which ids name a real piece of a ritual set, so a person's own link cannot point at a made-up one. Pure: it imports only
// the tools' data files, never the database, so it can be tested and used anywhere.

import { TAROT_DECK } from "./cards";
import { RUNES } from "./runes-data";
import { STAVES } from "./ogham-data";
import { DICE_OBJECTS, facesOf, faceId } from "./dice-data";
import { PENDULUM_MEANINGS } from "./common-meanings-data";
import { SCRYING_SURFACES } from "./scrying-surfaces";
import { HEXAGRAMS } from "./iching-data";
import { FIGURES } from "./geomancy-data";

let known: Set<string> | null = null;

function allKnown(): Set<string> {
  if (known) return known;
  const out = new Set<string>();
  for (const c of TAROT_DECK) out.add(c.id);
  for (const r of RUNES) out.add(r.id);
  for (const s of STAVES) out.add(s.id);
  for (const o of DICE_OBJECTS) for (const f of facesOf(o.id)) out.add(faceId(o.id, f));
  for (const k of Object.keys(PENDULUM_MEANINGS)) out.add(k);
  for (const s of SCRYING_SURFACES) out.add(`scrying-${s}`);
  for (const h of HEXAGRAMS) out.add(h.id);
  for (const x of FIGURES) out.add(x.id);
  known = out;
  return out;
}

/**
 * True for the id of a piece the app has: a tarot card ("major-0"), a rune, an ogham letter, a face of a die or a coin
 * ("die-d6-3", "coin-heads"), a pendulum swing (the five built in, or a line at a whole-degree angle the person added,
 * "swing-line-45"), a scrying surface, a hexagram ("hexagram-12") or a geomantic figure ("geomancy-via"). A person's own oracle items are linked by their own id instead.
 */
export function isKnownSymbolId(id: string): boolean {
  if (allKnown().has(id)) return true;
  const line = /^swing-line-(\d{1,3})$/.exec(id);
  return !!line && Number(line[1]) >= 0 && Number(line[1]) < 180 && String(Number(line[1])) === line[1];
}

/** Every built-in piece id (for tests). */
export function knownSymbolIds(): string[] {
  return [...allKnown()];
}

/** The shape every piece id has, checked before anything else looks at it. Pendulum swings have an underscore ("swing-circle_cw"). */
export const SYMBOL_ID_SHAPE = /^[a-z0-9][a-z0-9_-]{0,79}$/;
