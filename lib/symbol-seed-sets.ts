import { RUNES } from "./runes-data";
import { STAVES } from "./ogham-data";
import { DICE_OBJECTS, faceId, facesOf, isNumbered } from "./dice-data";
import { COIN_MEANINGS, PENDULUM_MEANINGS, SCRYING_MEANINGS } from "./common-meanings-data";

// The hand-written files of shared links between pieces of a tool and the archetypes, and the piece ids each file has to cover. One list for
// scripts/seed-symbol-archetypes.ts (the hosted databases) and lib/local-seed.ts (a fresh local folder). The tarot file waits for the owner's review
// (open item R1), so it is not here. No database code: tests can import it.

export interface SymbolSet {
  tool: "runes" | "ogham" | "dice" | "pendulum" | "scrying";
  file: string;
  ids: string[];
}

/** The two sides of a coin and every face of every numbered die. A knucklebone has no shared links, so it is left out. */
export function symbolIdsOfDice(): string[] {
  const ids = Object.keys(COIN_MEANINGS);
  for (const o of DICE_OBJECTS) if (isNumbered(o.id)) for (const f of facesOf(o.id)) ids.push(faceId(o.id, f));
  return ids;
}

export function symbolSets(): SymbolSet[] {
  return [
    { tool: "runes", file: "data/symbol-archetypes-runes.txt", ids: RUNES.map((r) => r.id) },
    { tool: "ogham", file: "data/symbol-archetypes-ogham.txt", ids: STAVES.map((s) => s.id) },
    { tool: "dice", file: "data/symbol-archetypes-dice.txt", ids: symbolIdsOfDice() },
    { tool: "pendulum", file: "data/symbol-archetypes-pendulum.txt", ids: Object.keys(PENDULUM_MEANINGS) },
    { tool: "scrying", file: "data/symbol-archetypes-scrying.txt", ids: Object.keys(SCRYING_MEANINGS) },
  ];
}
