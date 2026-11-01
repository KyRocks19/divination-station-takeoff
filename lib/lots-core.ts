// Lots from a bag: a set the person fills with names (or stones, staves or charms) and draws from without looking. This file has the rules for the three
// things lots need beyond a single pull: adding many names at once, drawing a number of them, and setting drawn ones aside so the bag empties until they are put
// back. It touches no database code, so screens that run in the browser can import it. The app gives no meaning to any lot: the person decides what it stands for.

/** The most names one paste can add, and the longest name. A set holds at most 1,000 items in all (the card route checks that). */
export const MAX_PASTE_NAMES = 200;
export const MAX_LOT_NAME = 200;
export const MAX_SET_ITEMS = 1000;
/** The most lots one draw can take. */
export const MAX_DRAW_LOTS = 24;

/**
 * The names in a pasted list, one to a line: trimmed, blank lines dropped, and a name that already appeared earlier in the paste (ignoring capital letters and
 * extra spaces) dropped too. `tooLong` counts names over MAX_LOT_NAME characters, which are left out; `over` counts names past MAX_PASTE_NAMES.
 */
export function namesFromText(text: unknown): { names: string[]; repeats: number; tooLong: number; over: number } {
  const out = { names: [] as string[], repeats: 0, tooLong: 0, over: 0 };
  if (typeof text !== "string") return out;
  const seen = new Set<string>();
  for (const raw of text.split(/\r?\n/)) {
    const name = raw.replace(/\s+/g, " ").trim();
    if (!name) continue;
    if (name.length > MAX_LOT_NAME) { out.tooLong++; continue; }
    const key = name.toLowerCase();
    if (seen.has(key)) { out.repeats++; continue; }
    if (out.names.length >= MAX_PASTE_NAMES) { out.over++; continue; }
    seen.add(key);
    out.names.push(name);
  }
  return out;
}

/** A whole number from 1 to `available` (and no more than MAX_DRAW_LOTS), or null. */
export function cleanLotCount(value: unknown, available: number): number | null {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  const max = Math.min(MAX_DRAW_LOTS, available);
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= max ? n : null;
}

/** The bag in words: "12 in the bag" or "9 in the bag, 3 set aside". */
export function bagWords(inBag: number, aside: number, group: string): string {
  return aside > 0 ? `${inBag} in the ${group}, ${aside} set aside` : `${inBag} in the ${group}`;
}
