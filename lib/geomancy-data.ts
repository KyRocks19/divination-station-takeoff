// Geomancy (Arabic 'ilm al-raml, "the science of the sand"; Latin geomantia): the sixteen figures, how four Mothers become a chart of fifteen figures
// and a Reconciler, and the twelve houses the figures are placed in. This file touches no database code, so screens that run in the browser can import it.
//
// What is in here is only what the sources agree on and can be checked by counting: each figure's Latin name, the usual English meaning of that name, and its
// four lines of one or two dots; and the arithmetic that makes a chart. The correspondences that authors give the figures (planets, signs, elements and
// the like) differ from one author to the next, so the app gives none. What a figure means is the person's to write.

export interface Figure {
  /** The id the person's own words for it are kept under, like 'geomancy-via'. */
  id: string;
  latin: string;
  /** The usual English meaning of the Latin name. */
  english: string;
  /** The four lines from the top (the "Fire" line) to the bottom (the "Earth" line): 1 is a single dot, 2 a double dot. */
  lines: [number, number, number, number];
}

/** The names of the four lines, top to bottom. Each element is "active" in a figure where its line is a single dot. */
export const LINE_ELEMENTS = ["Fire", "Air", "Water", "Earth"] as const;

const f = (id: string, latin: string, english: string, lines: [number, number, number, number]): Figure => ({ id: `geomancy-${id}`, latin, english, lines });

/** The sixteen figures, in the order the app lists them. */
export const FIGURES: Figure[] = [
  f("populus", "Populus", "people", [2, 2, 2, 2]),
  f("via", "Via", "way", [1, 1, 1, 1]),
  f("albus", "Albus", "white", [2, 2, 1, 2]),
  f("conjunctio", "Conjunctio", "conjunction", [2, 1, 1, 2]),
  f("puella", "Puella", "girl", [1, 2, 1, 1]),
  f("amissio", "Amissio", "loss", [2, 1, 2, 1]),
  f("fortuna-major", "Fortuna Major", "greater fortune", [2, 2, 1, 1]),
  f("fortuna-minor", "Fortuna Minor", "lesser fortune", [1, 1, 2, 2]),
  f("puer", "Puer", "boy", [1, 1, 2, 1]),
  f("rubeus", "Rubeus", "red", [2, 1, 2, 2]),
  f("acquisitio", "Acquisitio", "gain", [1, 2, 1, 2]),
  f("laetitia", "Laetitia", "joy", [1, 2, 2, 2]),
  f("tristitia", "Tristitia", "sorrow", [2, 2, 2, 1]),
  f("carcer", "Carcer", "prison", [1, 2, 2, 1]),
  f("caput-draconis", "Caput Draconis", "head of the dragon", [2, 1, 1, 1]),
  f("cauda-draconis", "Cauda Draconis", "tail of the dragon", [1, 1, 1, 2]),
];

export function getFigure(id: string): Figure | undefined {
  return FIGURES.find((x) => x.id === id);
}

export const isFigureId = (id: string) => getFigure(id) !== undefined;

const key = (lines: readonly number[]) => lines.join("");
const BY_LINES = new Map(FIGURES.map((x) => [key(x.lines), x] as const));

/** The figure with these four lines (every pattern of ones and twos is a figure). */
export function figureOfLines(lines: readonly number[]): Figure {
  return BY_LINES.get(key(lines))!;
}

/** How many dots a figure has in all: between 4 and 8. The Judge always has an even number. */
export const dotsOf = (x: Figure) => x.lines.reduce((n, v) => n + v, 0);

/** "●" for a single dot, "● ●" for a double dot, one line of text per line of the figure, top first. */
export const dotRows = (x: Figure) => x.lines.map((v) => (v === 1 ? "●" : "● ●"));

/** Two figures added line by line: two dots where the lines hold an even number of dots between them, one dot where odd. */
export function addFigures(a: Figure, b: Figure): Figure {
  return figureOfLines(a.lines.map((v, i) => ((v + b.lines[i]) % 2 === 0 ? 2 : 1)));
}

// ── Making a chart ───────────────────────────────────────────────────────────────────────────────────────

/** Where each figure of a chart sits, in the order a chart is read. */
export const PLACES = [
  "mother1", "mother2", "mother3", "mother4",
  "daughter1", "daughter2", "daughter3", "daughter4",
  "niece1", "niece2", "niece3", "niece4",
  "rightWitness", "leftWitness", "judge", "reconciler",
] as const;
export type Place = (typeof PLACES)[number];

/** What each place is called, in plain words. */
export const PLACE_WORDS: Record<Place, string> = {
  mother1: "First Mother", mother2: "Second Mother", mother3: "Third Mother", mother4: "Fourth Mother",
  daughter1: "First Daughter", daughter2: "Second Daughter", daughter3: "Third Daughter", daughter4: "Fourth Daughter",
  niece1: "First Niece", niece2: "Second Niece", niece3: "Third Niece", niece4: "Fourth Niece",
  rightWitness: "Right Witness", leftWitness: "Left Witness", judge: "Judge", reconciler: "Reconciler",
};

/** How a place is made, in a few words (the rules of Arabic geomancy as the sources give them). */
export const PLACE_HOW: Record<Place, string> = {
  mother1: "cast", mother2: "cast", mother3: "cast", mother4: "cast",
  daughter1: "the top lines of the four Mothers", daughter2: "the second lines of the four Mothers",
  daughter3: "the third lines of the four Mothers", daughter4: "the bottom lines of the four Mothers",
  niece1: "First and Second Mother added", niece2: "Third and Fourth Mother added",
  niece3: "First and Second Daughter added", niece4: "Third and Fourth Daughter added",
  rightWitness: "First and Second Niece added", leftWitness: "Third and Fourth Niece added",
  judge: "the two Witnesses added", reconciler: "the Judge and the First Mother added",
};

export type Chart = Record<Place, Figure>;

/** The whole chart from the four Mothers. */
export function buildChart(mothers: readonly [Figure, Figure, Figure, Figure]): Chart {
  const [m1, m2, m3, m4] = mothers;
  const daughter = (i: number) => figureOfLines(mothers.map((m) => m.lines[i]));
  const [d1, d2, d3, d4] = [0, 1, 2, 3].map(daughter);
  const n1 = addFigures(m1, m2);
  const n2 = addFigures(m3, m4);
  const n3 = addFigures(d1, d2);
  const n4 = addFigures(d3, d4);
  const rw = addFigures(n1, n2);
  const lw = addFigures(n3, n4);
  const judge = addFigures(rw, lw);
  return {
    mother1: m1, mother2: m2, mother3: m3, mother4: m4,
    daughter1: d1, daughter2: d2, daughter3: d3, daughter4: d4,
    niece1: n1, niece2: n2, niece3: n3, niece4: n4,
    rightWitness: rw, leftWitness: lw, judge, reconciler: addFigures(judge, m1),
  };
}

/** Four Mothers made by chance: each of the sixteen lines is a single or a double dot with equal chance, as when a line of marks is counted off in pairs. */
export function castMothers(rng: () => number): [Figure, Figure, Figure, Figure] {
  const lines = Array.from({ length: 16 }, () => (rng() < 0.5 ? 1 : 2));
  return [0, 1, 2, 3].map((m) => figureOfLines(lines.slice(m * 4, m * 4 + 4))) as [Figure, Figure, Figure, Figure];
}

/** Sixteen digits 1 or 2 (four per Mother, top line first) from the four Mothers, and back. */
export const mothersToText = (m: readonly Figure[]) => m.map((x) => key(x.lines)).join("");

export function mothersFromText(text: unknown): [Figure, Figure, Figure, Figure] | null {
  if (typeof text !== "string" || !/^[12]{16}$/.test(text)) return null;
  return [0, 1, 2, 3].map((m) => figureOfLines(text.slice(m * 4, m * 4 + 4).split("").map(Number))) as [Figure, Figure, Figure, Figure];
}

/** The four Mothers the person names themselves, by figure id. */
export function mothersFromIds(ids: unknown): [Figure, Figure, Figure, Figure] | null {
  if (!Array.isArray(ids) || ids.length !== 4) return null;
  const found = ids.map((id) => (typeof id === "string" ? getFigure(id) : undefined));
  return found.every(Boolean) ? (found as [Figure, Figure, Figure, Figure]) : null;
}

/** The one line kept on the shared record: "Judge: Via; Mothers: Populus, Via, Albus, Conjunctio". */
export function chartSummary(chart: Chart): string {
  return `Judge: ${chart.judge.latin}; Mothers: ${[chart.mother1, chart.mother2, chart.mother3, chart.mother4].map((x) => x.latin).join(", ")}`;
}

/** The figures a chart is kept as, one row per place, in the order of PLACES. */
export const chartRows = (chart: Chart) => PLACES.map((place, order) => ({ place, order, figure: chart[place] }));

// ── Houses ───────────────────────────────────────────────────────────────────────────────────────────────

export interface House {
  n: number;
  latin: string;
  /** The plain meaning of the Latin name. */
  english: string;
}

/**
 * The twelve houses by their traditional Latin names, borrowed from astrology (Wikipedia, 'House (astrology)'), with the plain meaning of each Latin word. The
 * first twelve figures of a chart go into them in order (Mothers, then Daughters, then Nieces); the sources say the order of allotment varied between groups.
 */
export const HOUSES: House[] = [
  { n: 1, latin: "Vita", english: "life" },
  { n: 2, latin: "Lucrum", english: "gain" },
  { n: 3, latin: "Fratres", english: "brothers" },
  { n: 4, latin: "Genitor", english: "parent" },
  { n: 5, latin: "Nati", english: "children" },
  { n: 6, latin: "Valetudo", english: "health" },
  { n: 7, latin: "Uxor", english: "spouse" },
  { n: 8, latin: "Mors", english: "death" },
  { n: 9, latin: "Iter", english: "journey" },
  { n: 10, latin: "Regnum", english: "kingdom" },
  { n: 11, latin: "Benefacta", english: "good deeds" },
  { n: 12, latin: "Carcer", english: "prison" },
];

/** The place of the figure in each house, house 1 first. */
export const HOUSE_PLACES: Place[] = PLACES.slice(0, 12);

export type CastMethod = "random" | "entered";
export const CAST_METHODS: CastMethod[] = ["random", "entered"];
export const METHOD_WORDS: Record<CastMethod, string> = {
  random: "Cast by the app: sixteen lines of dots, each single or double by chance",
  entered: "I cast the four Mothers myself and choose them",
};

export const GEOMANCY_SOURCES = {
  figures:
    "The Latin names and their usual English meanings follow Wikipedia's 'Geomantic figures'. The pictures of the figures could not be read as text there, so each figure's four lines were set from the rule that the single dots mark the elements it is active in, and checked against the way the figures pair as reversals of one another. The lines are named, from the top, Fire, Air, Water and Earth. Writers give the figures planets, signs and elements that differ from one another, so this app gives none.",
  chart:
    "The Mothers are cast, the Daughters are made from the Mothers' lines taken across, the Nieces and Witnesses and the Judge by adding figures two at a time (two dots where the lines hold an even number of dots, one where odd), and the Reconciler by adding the Judge and the First Mother (Wikipedia, 'Arabic geomancy'). The Reconciler is optional in some accounts.",
  houses:
    "The twelve houses have the traditional Latin names of the astrological houses (Wikipedia, 'House (astrology)'). The first twelve figures go into them in order here; the order of allotment varied between groups, and the Golden Dawn later simplified the method.",
} as const;
