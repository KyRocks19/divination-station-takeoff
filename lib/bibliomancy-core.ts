// Bibliomancy: opening "a book" at random and reading what the eye falls on. In this app the book is the person's own past writing. This file is the pure
// part (what counts as a word, a phrase or a sentence, which places of writing can be pulled from, and how a piece is picked); lib/bibliomancy.ts reads the
// writing from the database. Nothing here touches the database, so the form, the page and the tests can use it.
//
// The rules that matter: only words the person wrote themselves are ever pulled (never a line an AI wrote, never another person's writing), a pull is
// chosen by the random method the person set in Settings, and the app says nothing about what a passage means.

export const SOURCE_KINDS = ["journal", "day", "notes", "prediction", "meaning"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export const SOURCE_WORDS: Record<SourceKind, { label: string; hint: string }> = {
  journal: { label: "Journal entries", hint: "What you wrote about your readings, with any tool. Not what an AI wrote." },
  day: { label: "Day pages", hint: "What you wrote on your days." },
  notes: { label: "Notes on tarot readings", hint: "The notes you kept on a tarot reading itself." },
  prediction: { label: "Predictions", hint: "The words of your predictions as they stand now." },
  meaning: { label: "Your own meanings", hint: "What you wrote a card, rune, stave, hexagram, figure or oracle item means." },
};

/** The places a pull comes from when the person does not choose. */
export const DEFAULT_SOURCES: SourceKind[] = ["journal", "day", "notes"];

export const UNITS = ["word", "phrase", "sentence"] as const;
export type Unit = (typeof UNITS)[number];

export const UNIT_WORDS: Record<Unit, { label: string; hint: string }> = {
  word: { label: "A word", hint: "One word of four letters or more." },
  phrase: { label: "A phrase", hint: "A stretch of two or more words between marks such as commas, dashes and brackets." },
  sentence: { label: "A sentence", hint: "One sentence, or one line of a list." },
};

export const MAX_PULLS = 5;

/** The most pieces of writing looked at for one pull: the newest ones, if the person has more. */
export const MAX_POOL = 8000;
/** Shortest piece of writing worth pulling from, in characters. */
export const MIN_PIECE_CHARS = 20;
/** The longest passage or context kept. */
export const MAX_PASSAGE = 600;
export const MAX_CONTEXT = 300;

export function cleanSources(raw: unknown): SourceKind[] {
  if (!Array.isArray(raw)) return [];
  return SOURCE_KINDS.filter((k) => raw.includes(k));
}

export const isUnit = (v: unknown): v is Unit => typeof v === "string" && (UNITS as readonly string[]).includes(v);

/** How many pulls were asked for: a whole number from 1 to MAX_PULLS, or null. */
export function cleanPullCount(raw: unknown): number | null {
  const n = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= MAX_PULLS ? n : null;
}

// ── Reading a piece of writing ───────────────────────────────────────────────────────────────────────

/** Markdown taken off, so a pulled word is a word and not a mark: links keep their text, code and list marks, headings, quotes and emphasis go. */
export function plainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s*([-*+]|\d+[.)])\s+/gm, "")
    .replace(/[*_~]{1,3}([^*_~\n]+)[*_~]{1,3}/g, "$1")
    .replace(/[ \t]+/g, " ")
    .trim();
}

// A sentence ends at . ! ? or … (with any closing quote or bracket after it) followed by a space, or at a new line. Written without a look-behind, which older
// phones' browsers cannot read: a newline is put in after each sentence end and the text is split on newlines.
const SENTENCE_END = /([.!?…]["')\]”’]*)[ \t]+/gu;
const PHRASE_BREAK = /[,;:()\[\]—–“”"]| - |\.\.\./u;
const WORD = /\p{L}[\p{L}\p{M}'’-]*/gu;

const lettersIn = (s: string) => (s.match(/\p{L}/gu) ?? []).length;
const wordsIn = (s: string) => (s.match(WORD) ?? []).length;
const tidy = (s: string) => s.replace(/\s+/g, " ").trim();

/** The sentences of a text: each with at least three letters. */
export function sentencesOf(text: string): string[] {
  return plainText(text)
    .replace(SENTENCE_END, "$1\n")
    .split(/\n+/)
    .map(tidy)
    .filter((s) => lettersIn(s) >= 3);
}

export interface Unit_ {
  /** What is pulled. */
  passage: string;
  /** The sentence it was in, when that is not the passage itself. */
  context: string | null;
}

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** Every word, phrase or sentence of a text that can be pulled, each with its sentence. */
export function unitsOf(text: string, unit: Unit): Unit_[] {
  const out: Unit_[] = [];
  for (const sentence of sentencesOf(text)) {
    if (unit === "sentence") {
      out.push({ passage: cut(sentence, MAX_PASSAGE), context: null });
    } else if (unit === "phrase") {
      for (const part of sentence.split(PHRASE_BREAK).map(tidy)) {
        if (wordsIn(part) >= 2 && lettersIn(part) >= 6) out.push({ passage: cut(part, MAX_PASSAGE), context: cut(sentence, MAX_CONTEXT) });
      }
    } else {
      for (const w of sentence.match(WORD) ?? []) {
        const word = w.replace(/^[-'’]+|[-'’]+$/g, "");
        if (lettersIn(word) >= 4) out.push({ passage: word, context: cut(sentence, MAX_CONTEXT) });
      }
    }
  }
  return out;
}

// ── Picking ──────────────────────────────────────────────────────────────────────────────────────────

/** An index chosen with the chance of each equal to its weight's share of the total (every weight above zero), using the person's random function. */
export function weightedIndex(weights: number[], rng: () => number): number {
  const total = weights.reduce((n, w) => n + w, 0);
  if (weights.length === 0 || total <= 0) return -1;
  let r = Math.min(rng(), 0.9999999999) * total;
  for (const [i, w] of weights.entries()) {
    r -= w;
    if (r < 0) return i;
  }
  return weights.length - 1;
}

/** An index from 0 to length - 1, equal chances. */
export function uniformIndex(length: number, rng: () => number): number {
  return length <= 0 ? -1 : Math.min(length - 1, Math.floor(rng() * length));
}

/** The words that say where a piece of writing came from, for a kind that has no label of its own. */
export const SOURCE_FALLBACK_LABEL: Record<SourceKind, string> = {
  journal: "A journal entry",
  day: "A day page",
  notes: "Notes on a tarot reading",
  prediction: "A prediction",
  meaning: "One of your meanings",
};

/** The summary kept on the shared record: the passages in order, in quotation marks. */
export function pullSummary(passages: string[]): string {
  const joined = passages.map((p) => `“${p}”`).join(", ");
  return joined.length > 400 ? `${joined.slice(0, 399)}…` : joined;
}

export const BIBLIOMANCY_SOURCES = {
  history:
    "Bibliomancy is divination by opening a book at random and reading what the eye falls on. The old forms used a book the reader trusted: the Roman sortes opened Virgil or Homer, Christians opened the Bible, and in Iran the Divan of Hafez is still opened this way; the Persian falnama were books made for the purpose. Wikipedia's 'Bibliomancy' gives few dates for these.",
  here:
    "Here the book is your own past writing. That is this app's change, not an old practice. The app picks a piece of your writing and a place in it by chance, with the random method chosen in Settings, and shows it with the sentence around it. It does not say what the passage means. Only words you wrote yourself are used: never a line an AI wrote, and never anyone else's writing.",
} as const;
