export type Element = "Fire" | "Earth" | "Air" | "Water";

export interface CardAssociations {
  element?: Element;
  cosmicRuler?: string;
  zodiacSign?: string;
  hermeticPrinciple?: string;
  color?: string;
  chord?: string;
  mundaneCard?: string;
  temperature?: "Hot" | "Cold";
  moisture?: "Dry" | "Wet";
  direction?: "In" | "Down" | "Up" | "Out";
  realm?: string;
  domain?: string;
}

// ─── Major Arcana: direct associations from St. Cepesa Horat ─────────────────
const MAJOR: Record<string, CardAssociations> = {
  "major-0":  { element: "Air",   cosmicRuler: "Uranus",      hermeticPrinciple: "Mentalism",                           color: "Yellow",      chord: "E Natural",  mundaneCard: "wands-ace"    },
  "major-1":  { element: "Air",   cosmicRuler: "Mercury",     hermeticPrinciple: "Correspondence",                      color: "Yellow",      chord: "E Natural",  mundaneCard: "pentacles-8"  },
  "major-2":  { element: "Water", cosmicRuler: "Moon",                                                                   color: "Blue",        chord: "G Sharp",    mundaneCard: "swords-2"     },
  "major-3":  { element: "Earth", cosmicRuler: "Venus",                                                                  color: "Green",       chord: "F Sharp",    mundaneCard: "pentacles-9"  },
  "major-4":  { element: "Fire",  cosmicRuler: "Aries",       zodiacSign: "♈︎ Aries",       hermeticPrinciple: undefined, color: "Red",         chord: "C Natural",  mundaneCard: "wands-3"      },
  "major-5":  { element: "Earth", cosmicRuler: "Taurus",      zodiacSign: "♉︎ Taurus",      hermeticPrinciple: undefined, color: "Red-Orange",  chord: "C Sharp",    mundaneCard: "wands-2"      },
  "major-6":  { element: "Air",   cosmicRuler: "Gemini",      zodiacSign: "♊︎ Gemini",      hermeticPrinciple: "Gender",  color: "Orange",      chord: "D Natural",  mundaneCard: "cups-2"       },
  "major-7":  { element: "Water", cosmicRuler: "Cancer",      zodiacSign: "♋︎ Cancer",      hermeticPrinciple: undefined, color: "Orange-Yellow",chord: "D Sharp",   mundaneCard: "wands-6"      },
  "major-8":  { element: "Fire",  cosmicRuler: "Leo",         zodiacSign: "♌︎ Leo",         hermeticPrinciple: undefined, color: "Yellow",      chord: "E Natural",  mundaneCard: "wands-7"      },
  "major-9":  { element: "Earth", cosmicRuler: "Virgo",       zodiacSign: "♍︎ Virgo",       hermeticPrinciple: undefined, color: "Yellow-Green", chord: "F Natural", mundaneCard: "cups-8"       },
  "major-10": { element: "Fire",  cosmicRuler: "Jupiter",     hermeticPrinciple: "Rhythm",                              color: "Violet",      chord: "A Sharp",    mundaneCard: "pentacles-2"  },
  "major-11": { element: "Air",   cosmicRuler: "Libra",       zodiacSign: "♎︎ Libra",       hermeticPrinciple: "Cause and Effect", color: "Green", chord: "F Sharp", mundaneCard: "pentacles-6" },
  "major-12": { element: "Water", cosmicRuler: "Neptune",     hermeticPrinciple: "Polarity",                            color: "Blue",        chord: "G Sharp",    mundaneCard: "swords-4"     },
  "major-13": { element: "Water", cosmicRuler: "Scorpio",     zodiacSign: "♏︎ Scorpio",     hermeticPrinciple: undefined, color: "Blue-Green",  chord: "G Natural",  mundaneCard: "swords-10"    },
  "major-14": { element: "Fire",  cosmicRuler: "Sagittarius", zodiacSign: "♐︎ Sagittarius", hermeticPrinciple: "Vibration", color: "Blue",     chord: "G Sharp",    mundaneCard: "swords-ace"   },
  "major-15": { element: "Earth", cosmicRuler: "Capricorn",   zodiacSign: "♑︎ Capricorn",   hermeticPrinciple: undefined, color: "Blue-Violet", chord: "A Natural", mundaneCard: "swords-8"     },
  "major-16": { element: "Fire",  cosmicRuler: "Mars",        hermeticPrinciple: undefined,                             color: "Red",         chord: "C Natural",  mundaneCard: "swords-3"     },
  "major-17": { element: "Air",   cosmicRuler: "Aquarius",    zodiacSign: "♒︎ Aquarius",    hermeticPrinciple: undefined, color: "Violet",      chord: "A Sharp",    mundaneCard: "cups-ace"     },
  "major-18": { element: "Water", cosmicRuler: "Pisces",      zodiacSign: "♓︎ Pisces",      hermeticPrinciple: undefined, color: "Violet-Red",  chord: "B Natural",  mundaneCard: "cups-7"       },
  "major-19": { element: "Fire",  cosmicRuler: "Sun",         hermeticPrinciple: undefined,                             color: "Orange",      chord: "D Natural",  mundaneCard: "cups-6"       },
  "major-20": { element: "Water", cosmicRuler: "Pluto",       hermeticPrinciple: undefined,                             color: "Red",         chord: "C Natural",  mundaneCard: "swords-9"     },
  "major-21": { element: "Earth", cosmicRuler: "Saturn",      hermeticPrinciple: undefined,                             color: "Blue-Violet", chord: "A Natural",  mundaneCard: "pentacles-10" },
};

// ─── Suit-level associations (apply to all cards in the suit) ─────────────────
const SUIT_BASE: Record<string, Omit<CardAssociations, "zodiacSign">> = {
  wands:     { element: "Fire",  temperature: "Hot",  moisture: "Dry", direction: "In",   realm: "Change",    domain: "Knowing"       },
  pentacles: { element: "Earth", temperature: "Cold", moisture: "Dry", direction: "Down", realm: "Physical",  domain: "Feeling"       },
  swords:    { element: "Air",   temperature: "Hot",  moisture: "Wet", direction: "Up",   realm: "Mental",    domain: "Thinking"      },
  cups:      { element: "Water", temperature: "Cold", moisture: "Wet", direction: "Out",  realm: "Emotional", domain: "Understanding" },
};

// ─── Rank → zodiac (from house system in Zodiac Data CSV) ────────────────────
const RANK_ZODIAC: Record<string, string> = {
  ace:    "♈︎ Aries",
  "2":    "♉︎ Taurus",
  "3":    "♊︎ Gemini",
  "4":    "♋︎ Cancer",
  "5":    "♌︎ Leo",
  "6":    "♍︎ Virgo",
  "7":    "♎︎ Libra",
  "8":    "♏︎ Scorpio",
  "9":    "♐︎ Sagittarius",
  "10":   "♑︎ Capricorn",
  page:   "♒︎ Aquarius",
  knight: "♓︎ Pisces",
};

export function getCardAssociations(cardId: string): CardAssociations {
  if (cardId.startsWith("major-")) return MAJOR[cardId] ?? {};
  const [suit, rank] = cardId.split("-");
  const base = SUIT_BASE[suit] ?? {};
  const zodiacSign = RANK_ZODIAC[rank];
  return zodiacSign ? { ...base, zodiacSign } : { ...base };
}

// ─── Zodiac metadata ──────────────────────────────────────────────────────────
export const ZODIAC_ORDER = [
  "♈︎ Aries", "♉︎ Taurus", "♊︎ Gemini", "♋︎ Cancer",
  "♌︎ Leo",   "♍︎ Virgo",   "♎︎ Libra",  "♏︎ Scorpio",
  "♐︎ Sagittarius", "♑︎ Capricorn", "♒︎ Aquarius", "♓︎ Pisces",
] as const;

export type ZodiacSign = typeof ZODIAC_ORDER[number];

export interface ZodiacMeta {
  symbol: string;
  name: string;
  gloss: string;
  dates: string;
  element: Element;
  triplicity: "Cardinal" | "Fixed" | "Mutable";
}

export const ZODIAC_META: Record<ZodiacSign, ZodiacMeta> = {
  "♈︎ Aries":       { symbol: "♈︎", name: "Aries",       gloss: "The Ram",          dates: "Mar 21–Apr 19", element: "Fire",  triplicity: "Cardinal" },
  "♉︎ Taurus":      { symbol: "♉︎", name: "Taurus",      gloss: "The Bull",         dates: "Apr 20–May 20", element: "Earth", triplicity: "Fixed"    },
  "♊︎ Gemini":      { symbol: "♊︎", name: "Gemini",      gloss: "The Twins",        dates: "May 21–Jun 21", element: "Air",   triplicity: "Mutable"  },
  "♋︎ Cancer":      { symbol: "♋︎", name: "Cancer",      gloss: "The Crab",         dates: "Jun 22–Jul 22", element: "Water", triplicity: "Cardinal" },
  "♌︎ Leo":         { symbol: "♌︎", name: "Leo",         gloss: "The Lion",         dates: "Jul 23–Aug 22", element: "Fire",  triplicity: "Fixed"    },
  "♍︎ Virgo":       { symbol: "♍︎", name: "Virgo",       gloss: "The Maiden",       dates: "Aug 23–Sep 22", element: "Earth", triplicity: "Mutable"  },
  "♎︎ Libra":       { symbol: "♎︎", name: "Libra",       gloss: "The Scales",       dates: "Sep 23–Oct 22", element: "Air",   triplicity: "Cardinal" },
  "♏︎ Scorpio":     { symbol: "♏︎", name: "Scorpio",     gloss: "The Scorpion",     dates: "Oct 23–Nov 22", element: "Water", triplicity: "Fixed"    },
  "♐︎ Sagittarius": { symbol: "♐︎", name: "Sagittarius", gloss: "The Archer",       dates: "Nov 23–Dec 21", element: "Fire",  triplicity: "Mutable"  },
  "♑︎ Capricorn":   { symbol: "♑︎", name: "Capricorn",   gloss: "The Goat",         dates: "Dec 22–Jan 19", element: "Earth", triplicity: "Cardinal" },
  "♒︎ Aquarius":    { symbol: "♒︎", name: "Aquarius",    gloss: "The Water-bearer", dates: "Jan 20–Feb 18", element: "Air",   triplicity: "Fixed"    },
  "♓︎ Pisces":      { symbol: "♓︎", name: "Pisces",      gloss: "The Fish",         dates: "Feb 19–Mar 20", element: "Water", triplicity: "Mutable"  },
};

// ─── Element colors (matching SUIT_META) ─────────────────────────────────────
export const ELEMENT_COLOR: Record<Element, string> = {
  Fire:  "#f59e0b",
  Earth: "#10b981",
  Air:   "#94a3b8",
  Water: "#3b82f6",
};

// ─── Planet metadata ──────────────────────────────────────────────────────────
export const PLANET_META: Record<string, { symbol: string; color: string }> = {
  Sun:         { symbol: "☉", color: "#fbbf24" },
  Moon:        { symbol: "☾", color: "#e0e7ff" },
  Mercury:     { symbol: "☿", color: "#94a3b8" },
  Venus:       { symbol: "♀", color: "#f9a8d4" },
  Mars:        { symbol: "♂", color: "#ef4444" },
  Jupiter:     { symbol: "♃", color: "#fb923c" },
  Saturn:      { symbol: "♄", color: "#a78bfa" },
  Uranus:      { symbol: "♅", color: "#67e8f9" },
  Neptune:     { symbol: "♆", color: "#818cf8" },
  Pluto:       { symbol: "♇", color: "#c084fc" },
  Aries:       { symbol: "♈︎", color: "#f59e0b" },
  Taurus:      { symbol: "♉︎", color: "#10b981" },
  Gemini:      { symbol: "♊︎", color: "#94a3b8" },
  Cancer:      { symbol: "♋︎", color: "#3b82f6" },
  Leo:         { symbol: "♌︎", color: "#f59e0b" },
  Virgo:       { symbol: "♍︎", color: "#10b981" },
  Libra:       { symbol: "♎︎", color: "#94a3b8" },
  Scorpio:     { symbol: "♏︎", color: "#3b82f6" },
  Sagittarius: { symbol: "♐︎", color: "#f59e0b" },
  Capricorn:   { symbol: "♑︎", color: "#10b981" },
  Aquarius:    { symbol: "♒︎", color: "#94a3b8" },
  Pisces:      { symbol: "♓︎", color: "#3b82f6" },
};
