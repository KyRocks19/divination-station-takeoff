// The I Ching (Yijing, Book of Changes): the 64 hexagrams, the 8 trigrams they are made of, and how a cast of six lines becomes a hexagram and,
// when some lines are changing, a second hexagram. This file touches no database code, so screens that run in the browser can import it.
//
// What is in here is only what the tradition fixes and anyone can check: the number of each hexagram in the usual (King Wen) order, its Chinese
// name, its pinyin, a short usual English name, and the two trigrams it is made of. The app does NOT carry any translation of the Judgment, the
// Images or the line texts (the best-known English translations, Wilhelm and Baynes 1950 and later, are in copyright; James Legge's of 1882 is in
// the public domain and is the one the sources page points to). What each hexagram means is the person's to write.

export type TrigramId = "qian" | "dui" | "li" | "zhen" | "xun" | "kan" | "gen" | "kun";

export interface Trigram {
  id: TrigramId;
  char: string;
  pinyin: string;
  /** The image the trigram is usually given. */
  english: string;
  /** Bottom to top; true is a solid (yang) line. */
  lines: [boolean, boolean, boolean];
}

/** In the order the King Wen table below uses for both its rows (the lower trigram) and its columns (the upper). */
export const TRIGRAMS: Trigram[] = [
  { id: "qian", char: "乾", pinyin: "Qián", english: "Heaven", lines: [true, true, true] },
  { id: "dui", char: "兌", pinyin: "Duì", english: "Lake", lines: [true, true, false] },
  { id: "li", char: "離", pinyin: "Lí", english: "Fire", lines: [true, false, true] },
  { id: "zhen", char: "震", pinyin: "Zhèn", english: "Thunder", lines: [true, false, false] },
  { id: "xun", char: "巽", pinyin: "Xùn", english: "Wind", lines: [false, true, true] },
  { id: "kan", char: "坎", pinyin: "Kǎn", english: "Water", lines: [false, true, false] },
  { id: "gen", char: "艮", pinyin: "Gèn", english: "Mountain", lines: [false, false, true] },
  { id: "kun", char: "坤", pinyin: "Kūn", english: "Earth", lines: [false, false, false] },
];

export function getTrigram(id: string): Trigram | undefined {
  return TRIGRAMS.find((t) => t.id === id);
}

/**
 * The number (King Wen order) of the hexagram with a given lower trigram (row) and upper trigram (column), both in TRIGRAMS order. The table
 * is checked in tests/iching-data.test.ts against the property of the King Wen sequence that hexagrams 2k-1 and 2k are always each other
 * turned upside down, or, when that changes nothing, each other with every line flipped.
 */
const KING_WEN: number[][] = [
  [1, 43, 14, 34, 9, 5, 26, 11],
  [10, 58, 38, 54, 61, 60, 41, 19],
  [13, 49, 30, 55, 37, 63, 22, 36],
  [25, 17, 21, 51, 42, 3, 27, 24],
  [44, 28, 50, 32, 57, 48, 18, 46],
  [6, 47, 64, 40, 59, 29, 4, 7],
  [33, 31, 56, 62, 53, 39, 52, 15],
  [12, 45, 35, 16, 20, 8, 23, 2],
];

// Number, character, pinyin, and a short usual English name (translators differ; these are plain glosses of the name, not a translation of any text).
const NAMES: [string, string, string][] = [
  ["乾", "Qián", "The Creative"],
  ["坤", "Kūn", "The Receptive"],
  ["屯", "Zhūn", "Difficulty at the start"],
  ["蒙", "Méng", "Youthful folly"],
  ["需", "Xū", "Waiting"],
  ["訟", "Sòng", "Conflict"],
  ["師", "Shī", "The army"],
  ["比", "Bǐ", "Holding together"],
  ["小畜", "Xiǎo Xù", "Small taming"],
  ["履", "Lǚ", "Treading"],
  ["泰", "Tài", "Peace"],
  ["否", "Pǐ", "Standstill"],
  ["同人", "Tóng Rén", "Fellowship"],
  ["大有", "Dà Yǒu", "Great possession"],
  ["謙", "Qiān", "Modesty"],
  ["豫", "Yù", "Enthusiasm"],
  ["隨", "Suí", "Following"],
  ["蠱", "Gǔ", "Work on the decayed"],
  ["臨", "Lín", "Approach"],
  ["觀", "Guān", "Contemplation"],
  ["噬嗑", "Shì Kè", "Biting through"],
  ["賁", "Bì", "Grace"],
  ["剝", "Bō", "Splitting apart"],
  ["復", "Fù", "Return"],
  ["無妄", "Wú Wàng", "Innocence"],
  ["大畜", "Dà Xù", "Great taming"],
  ["頤", "Yí", "Nourishment"],
  ["大過", "Dà Guò", "Great exceeding"],
  ["坎", "Kǎn", "The abyss"],
  ["離", "Lí", "The clinging fire"],
  ["咸", "Xián", "Influence"],
  ["恆", "Héng", "Duration"],
  ["遯", "Dùn", "Retreat"],
  ["大壯", "Dà Zhuàng", "Great power"],
  ["晉", "Jìn", "Progress"],
  ["明夷", "Míng Yí", "Darkening of the light"],
  ["家人", "Jiā Rén", "The family"],
  ["睽", "Kuí", "Opposition"],
  ["蹇", "Jiǎn", "Obstruction"],
  ["解", "Xiè", "Deliverance"],
  ["損", "Sǔn", "Decrease"],
  ["益", "Yì", "Increase"],
  ["夬", "Guài", "Breakthrough"],
  ["姤", "Gòu", "Coming to meet"],
  ["萃", "Cuì", "Gathering together"],
  ["升", "Shēng", "Pushing upward"],
  ["困", "Kùn", "Oppression"],
  ["井", "Jǐng", "The well"],
  ["革", "Gé", "Revolution"],
  ["鼎", "Dǐng", "The cauldron"],
  ["震", "Zhèn", "The arousing thunder"],
  ["艮", "Gèn", "Keeping still"],
  ["漸", "Jiàn", "Gradual development"],
  ["歸妹", "Guī Mèi", "The marrying maiden"],
  ["豐", "Fēng", "Abundance"],
  ["旅", "Lǚ", "The wanderer"],
  ["巽", "Xùn", "The gentle wind"],
  ["兌", "Duì", "The joyous lake"],
  ["渙", "Huàn", "Dispersion"],
  ["節", "Jié", "Limitation"],
  ["中孚", "Zhōng Fú", "Inner truth"],
  ["小過", "Xiǎo Guò", "Small exceeding"],
  ["既濟", "Jì Jì", "After completion"],
  ["未濟", "Wèi Jì", "Before completion"],
];

export interface Hexagram {
  /** 1 to 64, in the usual (King Wen) order. */
  n: number;
  /** The id the person's own words for it are kept under, like 'hexagram-12'. */
  id: string;
  char: string;
  pinyin: string;
  english: string;
  lower: TrigramId;
  upper: TrigramId;
  /** Bottom (line 1) to top (line 6); true is a solid (yang) line. */
  lines: boolean[];
}

function build(): Hexagram[] {
  const out: Hexagram[] = [];
  for (const [r, lower] of TRIGRAMS.entries()) {
    for (const [c, upper] of TRIGRAMS.entries()) {
      const n = KING_WEN[r][c];
      const [char, pinyin, english] = NAMES[n - 1];
      out[n - 1] = { n, id: `hexagram-${n}`, char, pinyin, english, lower: lower.id, upper: upper.id, lines: [...lower.lines, ...upper.lines] };
    }
  }
  return out;
}

export const HEXAGRAMS: Hexagram[] = build();

/** A hexagram by its number (1 to 64) or its id ('hexagram-12'). */
export function getHexagram(which: number | string): Hexagram | undefined {
  const n = typeof which === "number" ? which : /^hexagram-(\d{1,2})$/.test(which) ? Number(which.slice(9)) : NaN;
  return Number.isInteger(n) ? HEXAGRAMS[n - 1] : undefined;
}

export const isHexagramId = (id: string) => getHexagram(id) !== undefined;

/** The hexagram made by six lines, bottom to top (true is solid). */
export function hexagramOfLines(lines: boolean[]): Hexagram {
  const lower = TRIGRAMS.findIndex((t) => t.lines.every((v, i) => v === lines[i]));
  const upper = TRIGRAMS.findIndex((t) => t.lines.every((v, i) => v === lines[i + 3]));
  return HEXAGRAMS[KING_WEN[lower][upper] - 1];
}

/** "Heaven over Earth": the upper trigram's image, then the lower's. */
export function trigramWords(h: Hexagram): string {
  return `${getTrigram(h.upper)!.english} over ${getTrigram(h.lower)!.english}`;
}

// ── A cast ───────────────────────────────────────────────────────────────────────────────────────────────

/** What a line came to: 6 old yin and 9 old yang are changing; 7 young yang and 8 young yin stay. */
export type LineValue = 6 | 7 | 8 | 9;
export const LINE_VALUES: LineValue[] = [6, 7, 8, 9];

export const LINE_WORDS: Record<LineValue, string> = {
  6: "old yin (broken, changing)",
  7: "young yang (solid, staying)",
  8: "young yin (broken, staying)",
  9: "old yang (solid, changing)",
};

export const lineIsYang = (v: LineValue) => v === 7 || v === 9;
export const lineChanges = (v: LineValue) => v === 6 || v === 9;

export type CastMethod = "coins" | "yarrow" | "entered";
export const CAST_METHODS: CastMethod[] = ["coins", "yarrow", "entered"];
export const METHOD_WORDS: Record<CastMethod, string> = {
  coins: "Three coins, tossed by the app",
  yarrow: "Yarrow stalks, counted by the app",
  entered: "I cast it myself and enter the six lines",
};

/** The chance, out of 16, of each line value. Three coins (heads 3, tails 2) give 2, 6, 6, 2; yarrow stalks give 1, 5, 7, 3. */
export const COIN_WEIGHTS: Record<LineValue, number> = { 6: 2, 7: 6, 8: 6, 9: 2 };
export const YARROW_WEIGHTS: Record<LineValue, number> = { 6: 1, 7: 5, 8: 7, 9: 3 };

/** One line, picked with the person's random function `rng` (0 up to but not including 1). */
export function castLine(method: "coins" | "yarrow", rng: () => number): LineValue {
  if (method === "coins") {
    let total = 0;
    for (let i = 0; i < 3; i++) total += rng() < 0.5 ? 3 : 2;
    return total as LineValue;
  }
  let r = Math.min(15, Math.floor(rng() * 16));
  for (const v of LINE_VALUES) {
    r -= YARROW_WEIGHTS[v];
    if (r < 0) return v;
  }
  return 8;
}

/** Six lines, bottom (first) to top (last). */
export function castLines(method: "coins" | "yarrow", rng: () => number): LineValue[] {
  return Array.from({ length: 6 }, () => castLine(method, rng));
}

/** Six line values from text such as "789678", or from a list of numbers; null when it is not exactly six of 6, 7, 8 or 9. */
export function cleanLineValues(raw: unknown): LineValue[] | null {
  const list = typeof raw === "string" ? raw.split("") : Array.isArray(raw) ? raw : null;
  if (!list || list.length !== 6) return null;
  const out: LineValue[] = [];
  for (const item of list) {
    const n = typeof item === "string" ? Number(item) : item;
    if (n !== 6 && n !== 7 && n !== 8 && n !== 9) return null;
    out.push(n);
  }
  return out;
}

export const linesToText = (v: LineValue[]) => v.join("");

export interface CastResult {
  primary: Hexagram;
  /** The hexagram the changing lines turn it into; null when no line is changing. */
  relating: Hexagram | null;
  /** The numbers of the changing lines, 1 (bottom) to 6 (top). */
  changing: number[];
}

export function resultOf(values: LineValue[]): CastResult {
  const primary = hexagramOfLines(values.map(lineIsYang));
  const changing = values.flatMap((v, i) => (lineChanges(v) ? [i + 1] : []));
  const relating = changing.length > 0 ? hexagramOfLines(values.map((v) => (lineChanges(v) ? !lineIsYang(v) : lineIsYang(v)))) : null;
  return { primary, relating, changing };
}

/** What is kept on a cast's own row, from the six lines: the two hexagrams' numbers and names as they were at the time. */
export function castRow(values: LineValue[]) {
  const r = resultOf(values);
  return {
    primary_number: r.primary.n,
    primary_name: `${r.primary.pinyin} (${r.primary.english})`,
    relating_number: r.relating?.n ?? null,
    relating_name: r.relating ? `${r.relating.pinyin} (${r.relating.english})` : null,
  };
}

const hexName = (h: Hexagram) => `${h.n} ${h.pinyin} (${h.english})`;

/** The one line kept on the shared record: "Hexagram 3 Zhūn (Difficulty at the start), changing to 4 Méng (Youthful folly)". */
export function castSummary(values: LineValue[]): string {
  const r = resultOf(values);
  return r.relating ? `Hexagram ${hexName(r.primary)}, changing to ${hexName(r.relating)}` : `Hexagram ${hexName(r.primary)}, no changing lines`;
}

/** "Lines 2 and 5" / "Line 3" / "No line". */
export function changingWords(changing: number[]): string {
  if (changing.length === 0) return "No line is changing";
  if (changing.length === 1) return `Line ${changing[0]} is changing`;
  return `Lines ${changing.slice(0, -1).join(", ")} and ${changing[changing.length - 1]} are changing`;
}

export const ICHING_SOURCES = {
  hexagrams:
    "The numbers, characters, pinyin and trigrams of the 64 hexagrams follow the usual King Wen order as listed in Wikipedia's 'List of hexagrams of the I Ching'. The short English names here are plain glosses of each name; translators render them differently.",
  casting:
    "Three coins (heads counts 3, tails 2; the sum is the line) and yarrow stalks (49 stalks divided in three passes) are the two usual ways to cast a line, and they do not give the same odds: for old yin, young yang, young yin and old yang, the coins give 2, 6, 6, 2 chances in 16 and the yarrow stalks give 1, 5, 7, 3 (Wikipedia, 'I Ching divination').",
  texts:
    "This app carries no translation of the Judgments, Images or line texts. James Legge's 1882 translation (The Sacred Books of the East, vol. 16) is in the public domain; Wilhelm and Baynes (1950) and most later translations are in copyright. The meanings here are the ones you write.",
} as const;
