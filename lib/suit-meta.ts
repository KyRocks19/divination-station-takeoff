export interface SuitDist {
  suit: string;
  count: number;
  percentage: number;
}

export const SUIT_META: Record<string, { label: string; color: string; element: string }> = {
  major:     { label: "Major Arcana", color: "#7c3aed", element: "Spirit"  },
  cups:      { label: "Cups",         color: "#3b82f6", element: "Water"   },
  wands:     { label: "Wands",        color: "#f59e0b", element: "Fire"    },
  swords:    { label: "Swords",       color: "#94a3b8", element: "Air"     },
  pentacles: { label: "Pentacles",    color: "#10b981", element: "Earth"   },
};
