// The 20 ogham letters (feda) and the 5 later letters (forfeda), with their drawn shapes and the traditional text
// behind the "Traditional Meanings" button. This file touches no database code, so screens that run in the browser
// can import it.
//
// Rules from docs/archive/progress-history.md ("Wider plan"): the person's own meanings come first and this text opens only on a
// button; the text says where it comes from and how old it is, including which parts are modern; shapes are drawn
// by the app as SVG strokes. "Ogham" is the right word; a set cut on sticks is called ogham staves. No old source
// gives a divination meaning for each letter, and the "Celtic tree calendar" is a 20th-century idea.

/** The prefix of every stave id. It keeps ogham ids apart from tarot card ids and rune ids in `card_customizations`. */
export const STAVE_ID_PREFIX = "ogham-";

/** Where each piece of traditional text comes from, and how old it is. Shown with the text. */
export const OGHAM_SOURCES = {
  ogham:
    "Ogham is an early Irish alphabet. The oldest inscriptions on stone are from about the 4th century AD, and most are from the 5th and 6th centuries. The 20 main letters (feda) fall into four groups of five, told apart by the direction of their strokes. The sounds are scholars' reconstructions and some are uncertain.",
  trees:
    "The tree and plant names come from medieval Irish texts, such as the Auraicept na n-Éces (14th-century manuscripts), written long after the letters were named. Only about five to eight of the letter names are clearly tree names, so most of these are later glosses and some are disputed.",
  modern:
    "Modern divination keywords are from the 20th century. Using ogham to divine mostly comes from Robert Graves's The White Goddess (1948) and the writers who followed him. His 'tree calendar' is rejected by scholars. No old source gives a divination meaning for each letter; the only hint is an Irish tale of a druid cutting ogham on yew wands, which does not say how they were used. Authors differ widely.",
  forfeda:
    "The five later letters (forfeda) are found mostly in manuscripts, not on stones, and their values are uncertain. Their drawings here are simplified, because the manuscripts differ.",
  forfedaModern:
    "Modern divination books give the five later letters meanings of their own, and they differ more than for the main twenty. Most follow Liz and Colin Murray's The Celtic Tree Oracle (1988), which renamed them Koad (the grove), Oir (the spindle), Uilleand (the honeysuckle), Phagos (the beech) and Mor (the sea), partly from Robert Graves's essays. Which drawn shape goes with which later name is not settled. The readings below are each credited to the writer they come from. They were gathered from practitioners' summaries of these books, not checked against the books themselves.",
  kennings:
    "The word-ogham (Bríatharogam) are short riddling phrases for each letter, kept in medieval Irish manuscripts. They are not divination meanings, but they are the oldest layer of meaning the later letters have.",
  summaries:
    "Names, sounds, and tree glosses were checked against a scholarly summary (the Ogham article on Wikipedia, which cites McManus and others), not against the medieval texts themselves. Translators and scholars differ, and some words are disputed.",
} as const;

export interface Stave {
  /** For example "ogham-beith". */
  id: string;
  name: string;
  /** The sound it stands for, in plain letters; scholars' reconstruction. */
  sound: string;
  /** What the name means, and the medieval tree or plant gloss where there is one. */
  nameMeans: string;
  /** The group of five it is in: 1 (B), 2 (H), 3 (M), 4 (A, the vowels), or 0 for a later letter (forfeda). */
  aicme: 0 | 1 | 2 | 3 | 4;
  /** Strokes in a box 60 wide and 100 tall: each string is one "M x,y L x,y" path. */
  strokes: string[];
  /** Modern divination keywords. For a later letter, what most modern writers share; their own readings are in `voices`. */
  modern?: string;
  /** A later letter only: the name most modern divination books use (from Murray 1988), with what it names. */
  laterName?: { name: string; means: string };
  /** A later letter only: the medieval word-ogham phrases, translated. */
  kennings?: string;
  /** A later letter only: how named modern writers read it, each credited. */
  voices?: ForfidVoice[];
}

/** One modern writer's reading of a later letter. `sourceId` is a source in `lib/sources.ts` when there is one. */
export interface ForfidVoice {
  who: string;
  text: string;
  sourceId?: string;
}

// The stem runs up the middle; letters are cut from the bottom up, so the first stroke is the lowest.
const STEM = "M30,94 L30,6";
const Y = [82, 68, 54, 40, 26];

function groupStrokes(aicme: 1 | 2 | 3 | 4, count: number): string[] {
  const strokes = [STEM];
  for (const y of Y.slice(0, count)) {
    if (aicme === 1) strokes.push(`M30,${y} L52,${y}`); // to the right of the stem
    else if (aicme === 2) strokes.push(`M30,${y} L8,${y}`); // to the left of the stem
    else if (aicme === 3) strokes.push(`M12,${y + 8} L48,${y - 8}`); // slanting across the stem
    else strokes.push(`M16,${y} L44,${y}`); // straight across the stem
  }
  return strokes;
}

/** "Úath" becomes "ogham-uath": accents are dropped so the id is plain letters. */
function idOf(name: string): string {
  return STAVE_ID_PREFIX + name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
}

function letter(
  name: string, aicme: 1 | 2 | 3 | 4, count: number, sound: string, nameMeans: string, modern: string
): Stave {
  return { id: idOf(name), name, sound, nameMeans, aicme, strokes: groupStrokes(aicme, count), modern };
}

interface LaterText {
  nameMeans: string;
  laterName: { name: string; means: string };
  kennings: string;
  modern: string;
  voices: ForfidVoice[];
}

function later(name: string, sound: string, strokes: string[], text: LaterText): Stave {
  return { id: idOf(name), name, sound, aicme: 0, strokes: [STEM, ...strokes], ...text };
}

const MURRAY = "murray-1988";
const GREER = "greer-2006";
const LAURIE = "laurie-2007";

export const STAVES: Stave[] = [
  letter("Beith", 1, 1, "b", "birch", "Beginnings, cleansing, renewal."),
  letter("Luis", 1, 2, "l", "a plant; later glossed as rowan", "Protection, insight, a quickening."),
  letter("Fearn", 1, 3, "w (later f)", "alder", "Shelter, guidance, standing firm."),
  letter("Sail", 1, 4, "s", "willow", "Flow, intuition, adapting to change."),
  letter("Nion", 1, 5, "n", "fork or loft; later glossed as ash", "Connection, the weaving of events, peace."),
  letter("Úath", 2, 1, "h (the value is unclear)", "horror or fear; later glossed as whitethorn", "Challenge, patience, cleansing."),
  letter("Dair", 2, 2, "d", "oak", "Strength, endurance, a doorway."),
  letter("Tinne", 2, 3, "t", "a metal ingot; later glossed as holly", "Courage, challenge, balance."),
  letter("Coll", 2, 4, "c or k", "hazel", "Wisdom, creativity, knowledge gained."),
  letter("Ceirt", 2, 5, "q (later k)", "a bush or a rag; later glossed as apple", "Choice, beauty, what you value."),
  letter("Muin", 3, 1, "m", "neck, ruse, or love; later glossed as vine", "Truth, expression, gathering."),
  letter("Gort", 3, 2, "g", "a field; later glossed as ivy", "Growth, persistence, winding paths."),
  letter("Ngéadal", 3, 3, "ng", "killing; later glossed as broom or fern", "Healing, clearing, making room."),
  letter("Straif", 3, 4, "st (uncertain)", "sulphur; later glossed as blackthorn", "Fate, necessity, a hard turn."),
  letter("Ruis", 3, 5, "r", "red; later glossed as elder", "Endings and renewal, the wisdom of age."),
  letter("Ailm", 4, 1, "a", "possibly pine or fir", "Clarity, vision, a wide view."),
  letter("Onn", 4, 2, "o", "later glossed as gorse", "Gathering, resilience, warmth."),
  letter("Úr", 4, 3, "u", "earth, clay, or soil; later glossed as heath", "Belonging, healing, passion."),
  letter("Eadhadh", 4, 4, "e", "unknown; later glossed as aspen", "Perseverance, courage under pressure."),
  letter("Iodhadh", 4, 5, "i", "unknown; later glossed as yew", "Endings that lead to beginnings, long memory."),
  // The five later letters. Their shapes differ between manuscripts; these are simple versions.
  later("Éabhadh", "ea (also given as k, x, or eo)", ["M14,36 L46,64", "M46,36 L14,64"], {
    nameMeans: "uncertain; glossed as aspen in the Auraicept",
    laterName: { name: "Koad", means: "the grove" },
    kennings: "\"Fair-swimming letter\"; \"fairest fish\".",
    modern: "Many paths at once; knowledge gathered together; a still centre among many factors.",
    voices: [
      { who: "Liz and Colin Murray", sourceId: MURRAY, text: "The grove: sacred places, often near springs; \"all knowledge\", the gathering of what you already know." },
      { who: "John Michael Greer", sourceId: GREER, text: "Central balance and endless possibility: many factors present, and the freedom that gives. Reversed: confusion, too many factors to see the outcome." },
      { who: "Erynn Rowan Laurie", sourceId: LAURIE, text: "Read as the salmon: a carrier of wisdom, inspiration and spiritual nourishment." },
      { who: "John Matthews", text: "Ability." },
      { who: "Nigel Pennick", text: "The point of total clarity." },
      { who: "Robert Ellison", text: "Read as white poplar: buoyancy, floating above problems." },
    ],
  }),
  later("Óir", "oi", ["M30,34 L44,50 L30,66 L16,50 Z"], {
    nameMeans: "gold; glossed as spindle tree or ivy in the Auraicept",
    laterName: { name: "Oir", means: "the spindle" },
    kennings: "\"Most venerable substance\"; \"splendour of form\".",
    modern: "Sudden change or sudden insight, often from outside; worth and what is valued.",
    voices: [
      { who: "Liz and Colin Murray", sourceId: MURRAY, text: "\"Sweetness, delight and sudden intelligence\", linked to thunder and inspiration." },
      { who: "John Michael Greer", sourceId: GREER, text: "A letter of fate: sudden change and the unexpected, coming from outside, like a lightning flash. Reversed: patience; a path that cannot be hurried." },
      { who: "Erynn Rowan Laurie", sourceId: LAURIE, text: "Gold: worth, value and wealth." },
      { who: "John Matthews", text: "Truth." },
      { who: "Robert Ellison", text: "Community and working within the home." },
      { who: "Sandra Kynes", text: "Finish your obligations before you can move on; duty and patience." },
    ],
  }),
  later("Uilleann", "ui", ["M40,32 Q16,50 40,68"], {
    nameMeans: "elbow; glossed as honeysuckle in the Auraicept",
    laterName: { name: "Uilleand", means: "the honeysuckle" },
    kennings: "\"Fragrant tree\"; \"great elbow\".",
    modern: "Hidden things and secrets; small causes with large effects; what is wanted but not said.",
    voices: [
      { who: "Liz and Colin Murray", sourceId: MURRAY, text: "Hidden secrets: \"the special dance or step that leads into the labyrinth of inner knowledge\"." },
      { who: "John Michael Greer", sourceId: GREER, text: "The influence of the subtle and seemingly insignificant; hidden messages; small causes with large effects. Reversed: the situation is not what it seems." },
      { who: "Erynn Rowan Laurie", sourceId: LAURIE, text: "Flexibility, change and measurement." },
      { who: "John Matthews", text: "Discovery." },
      { who: "Nigel Pennick", text: "Hardness and resistance; knowledge that has been tried and tested." },
      { who: "Robert Ellison", text: "Drawing things together and binding." },
    ],
  }),
  later("Ifín", "p or ia (also called Pín)", ["M14,50 L30,34 L46,50 L30,66 L14,50", "M30,34 L30,66"], {
    nameMeans: "glossed as gooseberry or thorn in the Auraicept",
    laterName: { name: "Phagos", means: "the beech" },
    kennings: "\"Sweetest tree\"; \"most wonderful taste\".",
    modern: "The sweetness of life, read from the gooseberry; or old learning and the wisdom of the past, read from the beech.",
    voices: [
      { who: "Erynn Rowan Laurie", sourceId: LAURIE, text: "Divine influences; the sweetness of life." },
      { who: "John Michael Greer", sourceId: GREER, text: "As Phagos: knowledge and lore, study, the wisdom of the past as a guide. Reversed: neglecting what is already known." },
      { who: "Liz and Colin Murray", sourceId: MURRAY, text: "As Phagos: old knowledge, old writing, the wisdom of elders." },
      { who: "John Matthews", text: "Taste." },
      { who: "Nigel Pennick", text: "Read as the guelder rose: the dance of life." },
      { who: "Robert Ellison", text: "The Kindreds, especially those of nature." },
    ],
  }),
  later("Eamhancholl", "x or ai", ["M14,36 L46,64", "M46,36 L14,64", "M10,50 L50,50"], {
    nameMeans: "\"twin of hazel\"; later read as witch hazel",
    laterName: { name: "Mor", means: "the sea" },
    kennings: "\"Groan of a sick person\" (two of the lists agree).",
    modern: "Forces from outside and new arrivals; depths and what lies below the surface. The old phrases point to illness and weariness.",
    voices: [
      { who: "Liz and Colin Murray", sourceId: MURRAY, text: "The sea: travel and the mother's line; \"hidden knowledge that is only available when the moon and sea are full\"." },
      { who: "John Michael Greer", sourceId: GREER, text: "Beginnings, endings and outside forces; the arrival of a new factor; destiny. Reversed: sudden endings, the familiar dissolving." },
      { who: "Erynn Rowan Laurie", sourceId: LAURIE, text: "A strengthening of the other letters; it can mean illness, following the old phrases." },
      { who: "John Matthews", text: "Exhaustion." },
      { who: "Robert Ellison", text: "Magic and hidden knowledge." },
    ],
  }),
];

const BY_ID = new Map(STAVES.map((s) => [s.id, s]));

/** One stave by its id, or undefined when the id is not in the set. */
export function getStave(id: string): Stave | undefined {
  return BY_ID.get(id);
}

/** The 20 main letters, or all 25 when the person includes the later letters. */
export function stavesFor(includeForfeda: boolean): Stave[] {
  return includeForfeda ? STAVES : STAVES.filter((s) => s.aicme !== 0);
}

/** The most staves one draw can hold: each stave comes up at most once. */
export function maxDraw(includeForfeda: boolean): number {
  return stavesFor(includeForfeda).length;
}

/** What the four groups of five and the later letters are called, in plain words. */
export const AICME_NAMES: Record<0 | 1 | 2 | 3 | 4, string> = {
  1: "First group (Beith to Nion): strokes to the right of the line",
  2: "Second group (Úath to Ceirt): strokes to the left of the line",
  3: "Third group (Muin to Ruis): strokes slanting across the line",
  4: "Fourth group (Ailm to Iodhadh): strokes straight across the line",
  0: "The five later letters (forfeda)",
};

/** Turns what a person typed into a whole number of staves from 1 up to the most a draw can hold, or null. */
export function cleanCount(value: unknown, includeForfeda: boolean): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= maxDraw(includeForfeda) ? n : null;
}
