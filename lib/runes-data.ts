// The 24 runes of the Elder Futhark, with their drawn shapes and the traditional text behind the "Traditional
// Meanings" button. This file touches no database code, so screens that run in the browser can import it.
//
// Rules from docs/archive/progress-history.md ("Wider plan"): the person's own meanings come first and this text opens only on a
// button; the text says where it comes from and how old it is; shapes are drawn by the app as SVG strokes, not
// taken from a font; the blank rune is left out because it was added in the 1980s and is not part of the old alphabet.

/** The prefix of every rune id. It keeps rune ids apart from tarot card ids in `card_customizations`. */
export const RUNE_ID_PREFIX = "rune-";

/** Where each piece of traditional text comes from, and how old it is. Shown with the text. */
export const RUNE_SOURCES = {
  futhark:
    "The Elder Futhark is the oldest runic alphabet, used from about the 2nd to the 8th century. The rune names below are reconstructed: nobody wrote them down in that period. Scholars work them out from later poems and alphabets, and some names are uncertain.",
  oe: "Old English Rune Poem: 29 verses, one per rune of the Anglo-Saxon alphabet, usually dated to the 8th or 9th century. Its only manuscript (10th or 11th century) burned in 1731; the text we have comes from a printing of 1705. At least one verse (Ger) names God, so it is not purely pre-Christian.",
  no: "Norwegian Rune Poem: sixteen verses, usually dated to about the 13th century. It survives only in a 17th-century copy of a lost manuscript, and it names Christ in one verse. It covers only the sixteen runes of the later Younger Futhark.",
  ic: "Icelandic Rune Poem: sixteen verses, usually dated to about the 15th century; its earliest manuscripts are from about 1500. It covers only the sixteen runes of the later Younger Futhark.",
  modern:
    "Modern divination keywords are from the 20th century. Using runes to divine, with a set meaning for each rune, mostly comes from books such as Ralph Blum's The Book of Runes (1982). The old poems describe what each rune stands for but give no reversed meanings, so those come from modern practice. Authors differ on them.",
  summaries: "The one-line summaries of the poems are paraphrased for this app, not quoted, and were checked against English translations (Dickins, 1915, for the Norwegian and Icelandic poems). Translators differ, and some words are disputed.",
} as const;

export interface Rune {
  /** For example "rune-fehu". */
  id: string;
  name: string;
  /** The sound it stands for, in plain letters. */
  sound: string;
  /** What the reconstructed name means. */
  nameMeans: string;
  /** Which of the three groups of eight it is in: 1, 2, or 3. */
  aett: 1 | 2 | 3;
  /** Strokes in a box 60 wide and 100 tall: each string is one "M x,y L x,y ..." path. */
  strokes: string[];
  /** False when the rune looks the same turned upside down, so it never lands reversed. */
  canReverse: boolean;
  /** Short summary of its verse in each poem, where the poem has one. */
  oe: string;
  no?: string;
  ic?: string;
  /** Modern divination keywords. */
  modern: string;
}

export const RUNES: Rune[] = [
  {
    id: "rune-fehu", name: "Fehu", sound: "f", nameMeans: "cattle, movable wealth", aett: 1, canReverse: true,
    strokes: ["M20,90 L20,10", "M20,38 L48,16", "M20,60 L48,38"],
    oe: "Wealth is a comfort to everyone, but each person should share it to gain a good name.",
    no: "Wealth causes quarrels among relatives; the wolf lives in the forest.",
    ic: "Wealth is a source of quarrels among relatives, a fire of the sea, and a path of serpents.",
    modern: "Wealth, resources, possessions, the flow of what sustains you.",
  },
  {
    id: "rune-uruz", name: "Uruz", sound: "u", nameMeans: "aurochs (a wild ox); the name is debated", aett: 1, canReverse: true,
    strokes: ["M14,90 L14,10 L44,34 L44,90"],
    oe: "The aurochs is fierce, with great horns, a wild creature of the moors that fights with its horns.",
    no: "Slag from poor iron; reindeer often run over frozen snow.",
    ic: "Drizzle, which spoils the hay harvest.",
    modern: "Strength, health, raw vitality, endurance.",
  },
  {
    id: "rune-thurisaz", name: "Thurisaz", sound: "th", nameMeans: "giant (some read it as thorn)", aett: 1, canReverse: true,
    strokes: ["M14,90 L14,10", "M14,30 L44,50 L14,70"],
    oe: "The thorn is very sharp and painful to anyone who grasps it.",
    no: "The giant brings sickness to women; few are glad of misfortune.",
    ic: "The giant is a torment to women.",
    modern: "Defence, a threshold, challenge, a reason to be careful.",
  },
  {
    id: "rune-ansuz", name: "Ansuz", sound: "a", nameMeans: "a god", aett: 1, canReverse: true,
    strokes: ["M18,90 L18,10", "M18,16 L44,36", "M18,38 L44,58"],
    oe: "Os is the source of speech and a support of wisdom, a comfort to the wise. The word can mean a god (Woden) or a mouth, and scholars disagree about which is meant.",
    no: "The river mouth is the way of most journeys; a scabbard is for swords.",
    ic: "An old god, lord of the gods' home.",
    modern: "Communication, a message, inspiration, insight.",
  },
  {
    id: "rune-raidho", name: "Raidho", sound: "r", nameMeans: "riding, a ride", aett: 1, canReverse: true,
    strokes: ["M14,90 L14,10 L42,28 L14,48", "M14,48 L44,90"],
    oe: "Riding seems easy to those indoors, but is hard for one on a great horse on the long road.",
    no: "Said to be the worst thing for horses; a smith made the finest sword.",
    ic: "The joy of the riders and the toil of the horse.",
    modern: "A journey, movement, rhythm, acting in the right way at the right time.",
  },
  {
    id: "rune-kenaz", name: "Kenaz", sound: "k", nameMeans: "torch (the Norse poems have an ulcer)", aett: 1, canReverse: true,
    strokes: ["M44,22 L16,50 L44,78"],
    oe: "The torch is known to all by its pale, bright flame; it burns where nobles rest indoors.",
    no: "A sore is deadly to children; illness turns a body pale.",
    ic: "An ulcer, a painful sore.",
    modern: "Light, knowledge, creativity, a skill that can be shared.",
  },
  {
    id: "rune-gebo", name: "Gebo", sound: "g", nameMeans: "gift", aett: 1, canReverse: false,
    strokes: ["M12,20 L48,80", "M48,20 L12,80"],
    oe: "Giving brings honour and worth, and helps those who have nothing else.",
    modern: "A gift, exchange, partnership, generosity in both directions.",
  },
  {
    id: "rune-wunjo", name: "Wunjo", sound: "w", nameMeans: "joy", aett: 1, canReverse: true,
    strokes: ["M16,90 L16,10 L44,28 L16,46"],
    oe: "Joy belongs to someone with few troubles, who has comfort and a good house.",
    modern: "Joy, comfort, harmony, wellbeing.",
  },
  {
    id: "rune-hagalaz", name: "Hagalaz", sound: "h", nameMeans: "hail", aett: 2, canReverse: false,
    strokes: ["M14,90 L14,10", "M46,90 L46,10", "M14,38 L46,62"],
    oe: "Hail is the whitest of grains; it falls from the sky, is tossed by the wind, then turns to water.",
    no: "The coldest of grains.",
    ic: "Cold grain, a shower of sleet.",
    modern: "Disruption, sudden change, forces outside your control.",
  },
  {
    id: "rune-nauthiz", name: "Nauthiz", sound: "n", nameMeans: "need", aett: 2, canReverse: false,
    strokes: ["M30,90 L30,10", "M18,38 L42,62"],
    oe: "Need is hard on the heart, yet it often turns into help and healing if heeded in time.",
    no: "Need leaves little choice; frost chills a person who has no clothes.",
    ic: "Hardship for the bondwoman, a state of oppression, toilsome work.",
    modern: "Need, constraint, endurance, what necessity asks of you.",
  },
  {
    id: "rune-isa", name: "Isa", sound: "i", nameMeans: "ice", aett: 2, canReverse: false,
    strokes: ["M30,90 L30,10"],
    oe: "Ice is very cold and endlessly slippery; it gleams clear as glass, a floor made by frost.",
    no: "A broad bridge; the blind must be led.",
    ic: "The bark of rivers and the roof of the wave.",
    modern: "Standstill, stillness, waiting, a pause.",
  },
  {
    id: "rune-jera", name: "Jera", sound: "j (as in year)", nameMeans: "year, harvest", aett: 2, canReverse: false,
    strokes: ["M30,14 L14,32 L30,50", "M30,50 L46,68 L30,86"],
    oe: "The year is a hope to people when God, the king of heaven, lets the earth give its bright fruits to rich and poor alike.",
    no: "A boon to people.",
    ic: "A boon to people and a good harvest.",
    modern: "A harvest, cycles, the reward of patient work.",
  },
  {
    id: "rune-eihwaz", name: "Eihwaz", sound: "ï (a vowel, like ei)", nameMeans: "yew", aett: 2, canReverse: false,
    strokes: ["M30,10 L30,90", "M30,10 L44,24", "M30,90 L16,76"],
    oe: "The yew is rough outside, hard and firm in the earth, a guardian of fire and a joy on the estate.",
    modern: "Endurance, continuity, the link between an ending and a beginning.",
  },
  {
    id: "rune-perthro", name: "Perthro", sound: "p", nameMeans: "unknown; the meaning of the name is not known", aett: 2, canReverse: true,
    strokes: ["M14,90 L14,10", "M14,10 L40,30 L14,50", "M14,50 L40,70 L14,90"],
    oe: "Unclear: translators read it as a game piece or dice cup, a source of play and laughter among warriors.",
    modern: "Mystery, chance, hidden things, the unknown.",
  },
  {
    id: "rune-algiz", name: "Algiz", sound: "z", nameMeans: "elk or elk-sedge; the name is uncertain", aett: 2, canReverse: true,
    strokes: ["M30,90 L30,10", "M30,50 L12,24", "M30,50 L48,24"],
    oe: "Elk-sedge lives in the marsh and grows in water; it wounds anyone who grasps at it.",
    no: "The verse for its later form (yr) says the yew is the greenest tree in winter and crackles when it burns.",
    ic: "The verse for its later form (yr) describes a bent bow, brittle iron, and the giant of the arrow.",
    modern: "Protection, shelter, a guardian, reaching toward something higher.",
  },
  {
    id: "rune-sowilo", name: "Sowilo", sound: "s", nameMeans: "sun", aett: 2, canReverse: false,
    strokes: ["M40,12 L20,38 L40,62 L20,88"],
    oe: "The sun is a hope to sailors crossing the sea until they reach land.",
    no: "The sun lights the world; the speaker bows to its holy judgement.",
    ic: "The shield of the clouds, a shining ray, and the destroyer of ice.",
    modern: "The sun, energy, success, guidance.",
  },
  {
    id: "rune-tiwaz", name: "Tiwaz", sound: "t", nameMeans: "the god Tyr", aett: 3, canReverse: true,
    strokes: ["M30,90 L30,10", "M12,34 L30,10 L48,34"],
    oe: "A guiding sign that keeps faith with nobles and holds its course through the night mists.",
    no: "Tyr is a one-handed god; the smith has to work the bellows often.",
    ic: "Tyr is a god with one hand, what the wolf left behind, and a ruler of temples.",
    modern: "Justice, honour, sacrifice, courage.",
  },
  {
    id: "rune-berkano", name: "Berkano", sound: "b", nameMeans: "birch", aett: 3, canReverse: true,
    strokes: ["M14,90 L14,10", "M14,10 L42,30 L14,50 L42,70 L14,90"],
    oe: "The birch bears no fruit but sends up shoots; it has fair branches and a high leafy crown.",
    no: "The greenest of shrubs.",
    ic: "A leafy twig, a young tree.",
    modern: "Growth, birth, renewal, home.",
  },
  {
    id: "rune-ehwaz", name: "Ehwaz", sound: "e", nameMeans: "horse", aett: 3, canReverse: true,
    strokes: ["M12,90 L12,10 L30,38 L48,10 L48,90"],
    oe: "The horse is a joy to nobles, proud on its hooves, a comfort to the restless.",
    modern: "Partnership, trust, steady movement, horse and rider working together.",
  },
  {
    id: "rune-mannaz", name: "Mannaz", sound: "m", nameMeans: "person, human being", aett: 3, canReverse: true,
    strokes: ["M12,90 L12,10", "M48,90 L48,10", "M12,10 L48,50", "M48,10 L12,50"],
    oe: "A person is dear to their kin, yet each will fail the other, for the lord decrees that the body goes to the earth.",
    no: "A person is the increase of the dust; the hawk's claw is strong.",
    ic: "A person is a delight, an enrichment of the earth, and an adorner of ships.",
    modern: "The self, humankind, community.",
  },
  {
    id: "rune-laguz", name: "Laguz", sound: "l", nameMeans: "water, lake", aett: 3, canReverse: true,
    strokes: ["M18,90 L18,10 L44,32"],
    oe: "Water seems endless to people on an unsteady ship, and the waves frighten them greatly.",
    no: "A waterfall drops from a mountainside; ornaments are made of gold.",
    ic: "Bubbling water, a broad geyser, and a land full of fish.",
    modern: "Water, flow, intuition, what lies below the surface.",
  },
  {
    id: "rune-ingwaz", name: "Ingwaz", sound: "ng", nameMeans: "the god Ing", aett: 3, canReverse: false,
    strokes: ["M30,18 L50,50 L30,82 L10,50 Z"],
    oe: "Ing was first seen among the East Danes, then went east over the sea, followed by his wagon.",
    modern: "Fertility, completion, rest before a new phase.",
  },
  {
    id: "rune-dagaz", name: "Dagaz", sound: "d", nameMeans: "day", aett: 3, canReverse: false,
    strokes: ["M12,22 L12,78 L48,22 L48,78 Z"],
    oe: "Day is a messenger, dear to people, a bright light and a hope and a help to all.",
    modern: "Day, breakthrough, awakening, a change of view.",
  },
  {
    id: "rune-othala", name: "Othala", sound: "o", nameMeans: "heritage, ancestral estate", aett: 3, canReverse: true,
    strokes: ["M30,12 L46,34 L30,56 L14,34 Z", "M24,48 L10,88", "M36,48 L50,88"],
    oe: "An estate is dear to everyone who can enjoy there, in peace and plenty, what is right and proper.",
    modern: "Heritage, home, inheritance, belonging.",
  },
];

const BY_ID = new Map(RUNES.map((r) => [r.id, r]));

/** One rune by its id, or undefined when the id is not in the set. */
export function getRune(id: string): Rune | undefined {
  return BY_ID.get(id);
}

/** The most runes one draw can hold: each rune comes up at most once. */
export const MAX_DRAW = RUNES.length;

/** What the three groups of eight are called, in plain words. */
export const AETT_NAMES: Record<1 | 2 | 3, string> = {
  1: "First group (Fehu to Wunjo)",
  2: "Second group (Hagalaz to Sowilo)",
  3: "Third group (Tiwaz to Othala)",
};

/** The default chance, out of 100, that a rune lands upside down when the person has turned reversals on. */
export const DEFAULT_REVERSAL_CHANCE = 50;

/** Turns what a person typed into a whole number from 0 to 100, or null when it is not one. */
export function cleanChance(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 100 ? n : null;
}

/** Turns what a person typed into a whole number of runes from 1 to 24, or null when it is not one. */
export function cleanCount(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= MAX_DRAW ? n : null;
}
