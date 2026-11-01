// Dice and a coin: the objects a person can throw, the faces each has, and the short history note behind the
// "A little history" button. This file touches no database code, so screens that run in the browser can import it.
//
// Rules from docs/archive/progress-history.md ("Wider plan"): the person's own meanings come first and the app supplies none. Dice and
// coins have no single tradition to quote, so there is no Traditional Meanings button; the history note says where
// each claim comes from and how sure it is. Nothing is scored; a total is plain arithmetic.

export type DiceObjectId = "coin" | "knucklebone" | "d4" | "d6" | "d8" | "d10" | "d12" | "d20" | "d100";

export interface DiceObject {
  id: DiceObjectId;
  /** What the object is called on screen. */
  name: string;
  /** How many faces it has. */
  faces: number;
  /**
   * True when the faces are named sides (Side A, Side B...), not numbers. Such an object has no number meanings and
   * no shared archetype links: the sources disagree about its sides, so the person's own words are all there is.
   */
  plainSides?: true;
}

export const DICE_OBJECTS: DiceObject[] = [
  { id: "coin", name: "Coin", faces: 2 },
  { id: "knucklebone", name: "Knucklebone (four sides)", faces: 4, plainSides: true },
  { id: "d4", name: "Four-sided die (d4)", faces: 4 },
  { id: "d6", name: "Six-sided die (d6)", faces: 6 },
  { id: "d8", name: "Eight-sided die (d8)", faces: 8 },
  { id: "d10", name: "Ten-sided die (d10)", faces: 10 },
  { id: "d12", name: "Twelve-sided die (d12)", faces: 12 },
  { id: "d20", name: "Twenty-sided die (d20)", faces: 20 },
  { id: "d100", name: "Hundred-sided die (d100)", faces: 100 },
];

export function getObject(id: string): DiceObject | undefined {
  return DICE_OBJECTS.find((o) => o.id === id);
}

/** True for a die with numbered faces: not the coin, and not an object whose sides are only named. */
export function isNumbered(object: string): boolean {
  const o = getObject(object);
  return !!o && o.id !== "coin" && !o.plainSides;
}

/** The faces of an object as plain text, in order: "heads" and "tails" for a coin, "a" to "d" for a knucklebone, "1" up to the last number for a die. */
export function facesOf(object: DiceObjectId): string[] {
  if (object === "coin") return ["heads", "tails"];
  if (object === "knucklebone") return ["a", "b", "c", "d"];
  const n = getObject(object)?.faces ?? 0;
  return Array.from({ length: n }, (_, i) => String(i + 1));
}

/** What a face is called on screen: "Heads", "Tails", "Side A" for a knucklebone, or the number. */
export function faceLabel(face: string): string {
  if (/^[a-d]$/.test(face)) return `Side ${face.toUpperCase()}`;
  return face === "heads" ? "Heads" : face === "tails" ? "Tails" : face;
}

/**
 * Plain words for the shape of each side of a real knucklebone, so a thrown bone can be matched to a side of this app. Checked on 2026-10-18
 * against three sources (see "dice.knucklebone-sides" in lib/sources.ts): all say the bone has two broad sides, one hollow and one rounded out,
 * and two narrow sides, one hollow (also called indented or wavy) and one flat (the 1911 Britannica says rounded out instead). The letters are
 * only labels: they are in no order that means anything, and the sources disagree on which side carried which value, so none is given.
 */
export const KNUCKLEBONE_SHAPES: Record<string, string> = {
  a: "broad and hollow",
  b: "broad and rounded out",
  c: "narrow and flat",
  d: "narrow and hollow",
};

/** The shape words for a knucklebone side ("a" to "d"), or null for anything else. */
export function sideShape(face: string): string | null {
  return KNUCKLEBONE_SHAPES[face] ?? null;
}

/** The id under which the person's own meaning for a face is kept, for example "die-d6-3" or "coin-heads". */
export function faceId(object: DiceObjectId, face: string): string {
  return object === "coin" ? `coin-${face}` : `die-${object}-${face}`;
}

/** Reads a face id back, or undefined when it is not one. `name` is for headings, for example "d6 · 3". */
export function getFace(id: string): { id: string; name: string; object: DiceObjectId; face: string } | undefined {
  const coin = /^coin-(heads|tails)$/.exec(id);
  if (coin) return { id, name: `Coin · ${faceLabel(coin[1])}`, object: "coin", face: coin[1] };
  const bone = /^die-knucklebone-([a-d])$/.exec(id);
  if (bone) return { id, name: `Knucklebone · ${faceLabel(bone[1])}`, object: "knucklebone", face: bone[1] };
  const die = /^die-(d\d+)-(\d+)$/.exec(id);
  if (!die) return undefined;
  const object = getObject(die[1]);
  const n = Number(die[2]);
  if (!object || object.id === "coin" || String(n) !== die[2] || n < 1 || n > object.faces) return undefined;
  return { id, name: `${object.id} · ${n}`, object: object.id, face: die[2] };
}

/** The most dice one throw can have when no layout is used. With a layout, one is thrown for each position. */
export const MAX_THROW = 100;

/** Turns what a person typed into a whole number of dice from 1 to 100, or null. */
export function cleanThrowCount(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= MAX_THROW ? n : null;
}

/** The most different objects (rows of "2 × d6", "1 × coin") in one throw. */
export const MAX_THROW_ITEMS = 12;

/** One row of what to throw: this object, this many times. */
export interface ThrowItem {
  object: DiceObjectId;
  count: number;
}

/**
 * Reads what a person asked to throw: a list `items` (several objects in one throw), or the older single `object`
 * with a `count`. The whole throw is at most MAX_THROW results. Gives the list, or the message to send back.
 */
export function cleanThrowItems(body: unknown): { items: ThrowItem[] } | { error: string } {
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const raw = Array.isArray(b.items) ? b.items : [{ object: b.object, count: b.count ?? 1 }];
  if (raw.length < 1 || raw.length > MAX_THROW_ITEMS) {
    return { error: `a throw has from 1 to ${MAX_THROW_ITEMS} kinds of object` };
  }
  const items: ThrowItem[] = [];
  let total = 0;
  for (const r of raw) {
    const row = r && typeof r === "object" ? (r as Record<string, unknown>) : {};
    const object = getObject(typeof row.object === "string" ? row.object : "");
    if (!object) return { error: `object must be ${DICE_OBJECTS.map((o) => o.id).join(", ")}` };
    const count = cleanThrowCount(row.count ?? 1);
    if (count === null) return { error: `count must be a whole number from 1 to ${MAX_THROW}` };
    total += count;
    items.push({ object: object.id, count });
  }
  if (total > MAX_THROW) return { error: `a throw has at most ${MAX_THROW} results in all` };
  return { items };
}

/** The results of a throw gathered by object, in the order each object first came up. */
export function groupByObject(results: { object: DiceObjectId; face: string }[]): { object: DiceObjectId; faces: string[] }[] {
  const groups: { object: DiceObjectId; faces: string[] }[] = [];
  for (const r of results) {
    const g = groups.find((x) => x.object === r.object);
    if (g) g.faces.push(r.face);
    else groups.push({ object: r.object, faces: [r.face] });
  }
  return groups;
}

/** One line of a throw for lists: "Six-sided die (d6): 3, 5 · Coin: heads", cut off with "and 4 more" after `limit` results. */
export function throwLine(results: { object: DiceObjectId; face: string }[], limit = 12): string {
  let left = limit;
  const parts: string[] = [];
  for (const g of groupByObject(results)) {
    if (left <= 0) break;
    const shown = g.faces.slice(0, left);
    left -= shown.length;
    parts.push(`${getObject(g.object)?.name ?? g.object}: ${shown.join(", ")}`);
  }
  const more = results.length - (limit - Math.max(left, 0));
  return parts.join(" · ") + (more > 0 ? `, and ${more} more` : "");
}

/** The plain total of some numbered dice, or null when the object is a coin or a knucklebone. */
export function totalOf(object: DiceObjectId, faces: string[]): number | null {
  if (!isNumbered(object)) return null;
  return faces.reduce((sum, f) => sum + Number(f), 0);
}

/** How many heads and tails came up. */
export function tallyCoin(faces: string[]): { heads: number; tails: number } {
  return { heads: faces.filter((f) => f === "heads").length, tails: faces.filter((f) => f === "tails").length };
}

/** One line for the shared record: what was thrown and what came up. */
export function throwSummary(object: DiceObjectId, faces: string[]): string {
  const name = object === "coin" ? "Coin" : object === "knucklebone" ? "Knucklebone" : object;
  const total = totalOf(object, faces);
  const shown = faces.map(faceLabel).join(", ");
  return total !== null && faces.length > 1 ? `${name}: ${shown} (total ${total})` : `${name}: ${shown}`;
}

/** The same line for a throw of several objects: each object's own summary, side by side. */
export function throwSummaryOf(results: { object: DiceObjectId; face: string }[]): string {
  return groupByObject(results).map((g) => throwSummary(g.object, g.faces)).join("; ");
}

export interface HistorySection {
  heading: string;
  /** A key into CITES in lib/sources.ts, for the "Read more" line under the text. */
  topic?: string;
  text: string;
}

/** The history note. Each claim was checked against the sources below on 2026-10-11; dates differ between sources. */
export const DICE_HISTORY: HistorySection[] = [
  {
    heading: "Knucklebones came first",
    topic: "dice.knucklebones",
    text:
      "Before cube dice, people threw the ankle bones (astragali) of sheep, goats, and other hoofed animals. Worked and natural ones turn up at Neolithic sites across Eurasia and are usually thought to have been used for games, for divination, or as protection. They land on four sides, which is one reason early dice may have had four. Nobody knows who first used them; the most accepted view is that people came to it independently several times.",
  },
  {
    heading: "Counting the sides",
    topic: "dice.knucklebone-sides",
    text:
      "Greek and Roman writers gave the four sides of a knucklebone the values 1, 3, 4, and 6, and called the lowest throw the Dog. Accounts differ about which side carried which value. Because of that, this app does not number the sides. It calls them Side A to Side D, in no order that means anything, and gives no meaning to any of them. What each side means is for you to write, and you can give each side a name of your own. To help you tell the sides of a real bone apart, the app also describes each side's shape. Three sources agree that the bone has two broad sides, one hollow and one rounded out, and two narrow sides, one hollow and one flat (the 1911 Britannica calls the narrow one rounded out instead of flat). Side A is the broad hollow side, Side B the broad rounded one, Side C the narrow flat one and Side D the narrow hollow one. These are only labels for matching a bone to the app: they do not say which side carried which value, and a real bone can differ.",
  },
  {
    heading: "The oldest cube dice",
    text:
      "The oldest known made dice come from a grave at Shahr-i Sokhta (the Burnt City) in south-eastern Iran. They are usually dated to about 2800 to 2500 BCE, though sources give wider ranges. Four long dice were found with 27 tokens, for a board game of twenty squares. A board of the same layout was found in the Royal Cemetery at Ur, dated to about 2600 BCE.",
  },
  {
    heading: "Games or divination?",
    topic: "dice.games-or-divination",
    text:
      "Nobody can now say which came first. At Maresha in Israel, archaeologists found about 530 knucklebone dice from the Hellenistic period (about 2,300 years ago). Many were shaved, drilled, or filled with lead so they would throw more reliably. They are thought to have been used for both gaming and divination. Throwing lots, dice, or bones to read an answer is called cleromancy, from the Greek word for a lot.",
  },
  {
    heading: "A dice oracle in Greece",
    topic: "dice.bura",
    text:
      "The Greek writer Pausanias (2nd century CE) describes an oracle of Heracles in a cave near Bura in Achaea. The person prayed in front of a small statue, then threw four dice onto a table, and a tablet gave an explanation for every combination. Scholars think the dice were knucklebones. Pausanias's passage is hard to interpret, and the translators say so.",
  },
  {
    heading: "Mo, a Tibetan dice practice",
    topic: "dice.mo",
    text:
      "Mo is a Tibetan practice that uses dice. Its answers are regarded as coming from Manjushri, the bodhisattva of wisdom, and it is consulted about decisions on health, work, or travel. The best-known system was compiled by the lama Jamgön Mipham (1846 to 1912). The sources checked say the practice is old but give no dates for its start. It belongs to a living tradition, so the app does not reproduce its text.",
  },
  {
    heading: "The first coins",
    text:
      "The first coins were struck in Lydia, in western Anatolia (now Turkey), in the 7th century BCE. They were made of electrum, a natural mix of gold and silver. Sources date the start from about 650 to about 600 BCE; the securely dated early finds are from Ephesus. The Greek historian Herodotus (5th century BCE) credited the Lydians as the first to strike gold and silver coins. King Croesus (about 561 to 546 BCE) is credited with the first separate gold and silver coinage. One timeline puts the first coins on Aegina about 700 BCE, which most sources do not.",
  },
  {
    heading: "Coins in divination",
    topic: "dice.coin-divination",
    text:
      "Throwing coins to consult the Chinese I Ching, three coins at a time, is a later method than the older yarrow-stalk one. The sources checked say it came into favour in the Southern Song period (1127 to 1279 CE). No reliable source was found for older coin-tossing divination elsewhere, so none is claimed here.",
  },
  {
    heading: "What this does not say",
    text:
      "None of this tells you how to read a throw, and the app does not either. Dates and details differ between sources, and the note says where. What a face means is for you to write.",
  },
];

export interface HistorySource {
  title: string;
  url: string;
}

export const DICE_HISTORY_SOURCES: HistorySource[] = [
  { title: "Dice (Wikipedia)", url: "https://en.wikipedia.org/wiki/Dice" },
  {
    title: "Gaming and divination pieces: markers of ownership, or all three? (Anthropozoologica, 2022)",
    url: "https://bioone.org/journals/anthropozoologica/volume-57/issue-6/anthropozoologica2022v57a6/Gaming-and-divination-pieces-markers-of-ownership-or-all-three/10.5252/anthropozoologica2022v57a6.full",
  },
  { title: "Folklore Finds: Astragali, or Knucklebones (Museum of Cambridge)", url: "https://www.museumofcambridge.org.uk/2025/01/folklore-finds-astragali-or-knucklebones/" },
  { title: "Pausanias, Description of Greece 7.25 (Perseus)", url: "https://fgh.perseids.org/read/greekLit/tlg0525/tlg001/perseus-eng2/7.25.4-7.26.2" },
  { title: "Bura (Achaea) (Wikipedia)", url: "https://en.wikipedia.org/wiki/Bura_(Achaea)" },
  { title: "Mo (divination) (Wikipedia)", url: "https://en.wikipedia.org/wiki/Mo_(divination)" },
  { title: "Early Lydian coinage and chronology (Austrian Academy of Sciences)", url: "https://www.oeaw.ac.at/en/oeai/research/classical-studies/numismatics/early-lydian-coinage-and-chronology" },
  { title: "On the Origin of Specie (Velde, Federal Reserve Bank of Atlanta)", url: "https://www.atlantafed.org/-/media/documents/news/conferences/2012/monetary-economics/papers/velde.pdf" },
  { title: "I Ching divination (Wikipedia)", url: "https://en.wikipedia.org/wiki/I_Ching_divination" },
];
