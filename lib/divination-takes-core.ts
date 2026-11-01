// Takes on divination: the one-liners under the home page title (owner's request, 2026-10-26). Pure, so the browser and the
// tests can use it. Each is one view of what divination is, labelled with the kind of view it is, so no single one is the
// app's own claim: some are playful, some are a believer's, some are a skeptic's, some are plain. A person can keep the
// ones they like and write their own (migration 098, lib/divination-takes.ts). Both are shown on the Divination archetype
// page as part of their own meaning for it, and their own takes come round on the home page among the others.
//
// Rules for a new take: write it fresh (no quotations, which would need a source); a believer's take is a view, never a
// proven fact; a skeptic's take is curious, never a sneer at the person reading; keep each to one line. The ids are stored
// in people's accounts, so never change, reuse or remove one (a kept id that is not in the list is left out of every view).

export type TakeTone = "playful" | "believer" | "skeptic" | "plain";

export interface DivinationTake {
  /** Stored in people's accounts: never change it. */
  id: string;
  text: string;
  tone: TakeTone;
}

export const TONE_LABELS: Record<TakeTone, string> = {
  playful: "Tongue in cheek",
  believer: "A believer's take",
  skeptic: "A skeptic's take",
  plain: "A plain take",
};

export const TONE_ORDER: readonly TakeTone[] = ["plain", "believer", "skeptic", "playful"];

const t = (id: string, tone: TakeTone, text: string): DivinationTake => ({ id, tone, text });

export const TAKES: readonly DivinationTake[] = [
  // Plain. The first is the home page's earlier subtitle, in the owner's words.
  t("plain-possibilities", "plain", "A tool that shows you possibilities you might not have thought of yourself, using pictures, words and a healthy dose of randomness to shift your perspective."),
  t("plain-question", "plain", "Asking a question carefully enough that you start to hear your own answer."),
  t("plain-random-mirror", "plain", "A dose of chance, a set of pictures, and your own mind making sense of the two."),
  t("plain-old-practice", "plain", "Something people in many times and places have done when a choice felt too big."),
  t("plain-pause", "plain", "A pause between the question and the decision, with something to look at in the gap."),
  t("plain-new-angle", "plain", "Looking at a stuck question from an angle you would not have picked."),
  t("plain-conversation", "plain", "A conversation with symbols, where you do most of the talking."),
  t("plain-notice", "plain", "Practice at noticing your first impression before your second thoughts arrive."),
  t("plain-record", "plain", "Writing down a hunch, and coming back later to see how it turned out."),
  t("plain-many-tools", "plain", "Cards, stones, sticks, dice, smoke, tea and dreams: many doors to the same quiet room."),

  // A believer's take
  t("believer-signal", "believer", "Tuning in to a signal that is always there, under the noise of the day."),
  t("believer-knows", "believer", "Something in you already knows. The cards give it a way to speak."),
  t("believer-weave", "believer", "Reading the threads that tie this moment to the next one."),
  t("believer-not-random", "believer", "Chance is only chance until you ask it a question."),
  t("believer-psi", "believer", "A sense as real as sight and hearing, and like them, it gets sharper with use."),
  t("believer-meaningful", "believer", "Meaningful coincidence, invited on purpose."),
  t("believer-listening", "believer", "The world is always talking. Divination is learning to listen back."),
  t("believer-ancestors", "believer", "A line kept open to the wisdom of those who came before."),
  t("believer-time", "believer", "Time leaks a little. A reading is a cup held under the drip."),
  t("believer-intuition-muscle", "believer", "Intuition is a muscle, and every reading is a repetition."),

  // A skeptic's take
  t("skeptic-mirror", "skeptic", "A mirror with excellent lighting: what you see is mostly you, and that is the useful part."),
  t("skeptic-barnum", "skeptic", "Words general enough to fit anyone, which is why it helps to write down what you expected first."),
  t("skeptic-coin", "skeptic", "Flip a coin. If you are disappointed by the result, you have learned what you wanted."),
  t("skeptic-test-it", "skeptic", "A claim worth testing: write the prediction down first, then count the hits honestly."),
  t("skeptic-prompt", "skeptic", "A random writing prompt with very good art direction."),
  t("skeptic-pattern", "skeptic", "Your brain is a pattern finder that never switches off. Divination gives it a job."),
  t("skeptic-remember-hits", "skeptic", "The hits are memorable and the misses are quiet. Keeping records evens the score."),
  t("skeptic-still-useful", "skeptic", "It does not need to predict anything to help you think."),
  t("skeptic-chance", "skeptic", "Chance has no opinions, which makes it a very fair person to ask."),
  t("skeptic-curious", "skeptic", "Doubt it, try it, write it down, and see what your own records say."),

  // Tongue in cheek
  t("playful-overthinking", "playful", "Overthinking, but with props."),
  t("playful-group-chat", "playful", "Asking the universe for advice because the group chat was not helpful."),
  t("playful-weather", "playful", "Like a weather forecast, except the weather is your feelings."),
  t("playful-cards-know", "playful", "The cards know. The cards are not telling. The cards want you to journal about it."),
  t("playful-shuffle", "playful", "Shuffling until the answer looks like the one you hoped for. (Everyone does it once.)"),
  t("playful-tea", "playful", "The leaves at the bottom of the cup have opinions, and they will share them."),
  t("playful-spreadsheet", "playful", "A spreadsheet for the soul, with better pictures."),
  t("playful-pendulum", "playful", "Asking a necklace yes or no questions, and taking it seriously."),
  t("playful-dice", "playful", "Letting a small cube make big decisions, so you do not have to."),
  t("playful-three-am", "playful", "What you do at three in the morning instead of sleeping on it."),
  t("playful-tower", "playful", "Drawing the Tower and deciding it means renovations."),
  t("playful-runes", "playful", "Reading small rocks that have been to a lot of meetings."),
];

const BY_ID = new Map(TAKES.map((x) => [x.id, x]));

export const takeById = (id: string): DivinationTake | undefined => BY_ID.get(id);

export const isTakeId = (id: unknown): id is string => typeof id === "string" && BY_ID.has(id);

/** The shared archetype these takes belong to (lib/archetypes-data.ts). */
export const DIVINATION_SLUG = "divination";

/** The take after `index`, wrapping round; used by the "Another take" button so a press never shows the same one again. */
export const nextTakeIndex = (index: number, count: number = TAKES.length) => (count <= 1 ? 0 : (index + 1) % count);

/** A shuffled order of every take, from a seed, so the home page shows each one before any repeats. Pure: the same seed gives the same order. */
export function takeOrder(seed: number, count: number = TAKES.length): number[] {
  const order = Array.from({ length: count }, (_, i) => i);
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  for (let i = count - 1; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** Most takes one person may keep: all of them, with room for new ones. */
export const MAX_KEPT_TAKES = 500;

/** What the data export holds: the words of each kept take, so the file reads well without the app. */
export interface KeptTakesExport {
  kept_divination_takes: { text: string; kind: string; kept_on: string }[];
}

export function shapeKeptExport(rows: { take_id: string; created_at: string }[]): KeptTakesExport {
  const out: KeptTakesExport["kept_divination_takes"] = [];
  for (const r of rows) {
    const take = takeById(r.take_id);
    if (take) out.push({ text: take.text, kind: TONE_LABELS[take.tone], kept_on: new Date(r.created_at).toISOString().slice(0, 10) });
  }
  return { kept_divination_takes: out };
}

/** Markdown lines for the readable export; nothing when the person kept none. */
export function keptMarkdown(data: KeptTakesExport): string[] {
  if (data.kept_divination_takes.length === 0) return [];
  const out = ["", "## Takes on divination you kept", ""];
  for (const k of data.kept_divination_takes) out.push(`- ${k.text} (${k.kind}, kept ${k.kept_on})`);
  return out;
}

// ---------------------------------------------------------------- the person's own takes

/** One take the person wrote. Only they see it. */
export interface OwnTake {
  id: number;
  text: string;
  created_at: string;
}

export const OWN_TAKE_MAX_LENGTH = 200;
export const MAX_OWN_TAKES = 200;

export const OWN_TONE_LABEL = "Your take";

/** A take as it is kept: spaces and line breaks run together into one line. Null when nothing is left or it is too long. */
export function cleanOwnTake(text: unknown): string | null {
  if (typeof text !== "string") return null;
  const one = text.replace(/\s+/g, " ").trim();
  return one.length > 0 && one.length <= OWN_TAKE_MAX_LENGTH ? one : null;
}

/** One place in the home page's order: one of the app's takes, or one of the person's own. */
export type TakeSlot = { own: false; i: number } | { own: true; i: number };

/**
 * The home page's order for one visit. The app's takes come in a shuffled order, each once; when the person wrote takes of
 * their own, every third place is one of theirs (shuffled, coming round again), so their words turn up among the others.
 * Which of the three places comes first depends on the seed, so about one visit in three opens on one of their own.
 */
export function homeOrder(seed: number, stockCount: number = TAKES.length, ownCount = 0): TakeSlot[] {
  const stock = takeOrder(seed, stockCount);
  if (ownCount === 0) return stock.map((i) => ({ own: false, i }));
  const own = takeOrder(seed + 1, ownCount);
  const offset = Math.abs(Math.floor(seed)) % 3;
  const out: TakeSlot[] = [];
  let a = 0;
  let b = 0;
  for (let n = 0; a < stock.length; n++) {
    if ((n + offset) % 3 === 0) out.push({ own: true, i: own[b++ % own.length] });
    else out.push({ own: false, i: stock[a++] });
  }
  return out;
}

export interface OwnTakesExport {
  own_divination_takes: { text: string; written_on: string }[];
}

export function shapeOwnExport(rows: { text: string; created_at: string }[]): OwnTakesExport {
  return { own_divination_takes: rows.map((r) => ({ text: r.text, written_on: new Date(r.created_at).toISOString().slice(0, 10) })) };
}

export function ownMarkdownLines(data: OwnTakesExport): string[] {
  if (data.own_divination_takes.length === 0) return [];
  const out = ["", "## Your own takes on divination", ""];
  for (const t of data.own_divination_takes) out.push(`- ${t.text} (written ${t.written_on})`);
  return out;
}
