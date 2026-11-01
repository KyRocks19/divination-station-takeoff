// The limits and shapes of editing a stock piece's archetype links (open item R3), with no imports, so the editing screen in
// the browser can use them without pulling in the tools' data. The rules are in lib/symbol-edit-core.ts.

/** Most archetypes one piece may reach. The seeded pieces have 1 to 5. */
export const MAX_STOCK_LINKS = 8;
export const MAX_STOCK_NOTE = 2000;

export interface StockPiece {
  id: string;
  name: string;
  /** The heading it is listed under: "Runes", "Dice: d6", ... */
  group: string;
}

export type StockAspect = "light" | "shadow" | "neutral";
