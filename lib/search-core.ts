// The rules of the header's search, as plain functions: what a query is, how a name is matched and ranked, the few words
// shown around a match, and the shared things that live in code (the app's pages, the tarot cards, the runes, the ogham
// staves and the archetypes). No database here and no browser code, so tests need neither and the search window can
// import the types. The queries over concepts and the person's own writing are in lib/search.ts.
//
// Only names are searched for shared things: a result never shows a stock meaning (oracle-feature-design, rule 1).

import { ARCHETYPES } from "./archetypes-data";
import { TAROT_DECK, type Suit } from "./cards";
import { parseGroupNoteId } from "./card-groups";
import { getFace } from "./dice-data";
import { DIVINATION_KINDS, DIVINATION_KIND_LABELS, DIVINATION_KIND_START } from "./divination-kinds";
import { addDays, isValidDay } from "./days-core";
import { NAV_GROUPS, itemShown } from "./nav-groups";
import { shapeOf, type Shape } from "./edition";
import { RUNES } from "./runes-data";
import { STAVES } from "./ogham-data";
import { HEXAGRAMS, getHexagram } from "./iching-data";
import { cardOfMeaningId } from "./playingcards-data";
import { FIGURES, getFigure } from "./geomancy-data";

import {
  GROUP_LABELS,
  GROUP_ORDER,
  MIN_QUERY,
  PER_GROUP,
  cleanQuery,
  type SearchGroup,
  type SearchItem,
} from "./search-shared";

export * from "./search-shared";

/** Lower case with accents removed, one letter at a time, so positions can be mapped back (see snippetAround). */
function foldChar(c: string): string {
  return c.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Lower case, accents removed, anything that is not a letter or a digit made a space, runs of spaces made one. */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** The words of a query, normalised. */
export function queryWords(q: string): string[] {
  const n = normalize(q);
  return n ? n.split(" ") : [];
}

/**
 * How well a name matches a query, or null for no match. Higher is better:
 * 4 the whole name, 3 the start of the name, 2 the start of a word in it ("moon" in "The Moon"), 1 inside a word,
 * 0.5 every word of the query somewhere in it ("ace cups" in "Ace of Cups").
 */
export function scoreText(text: string, q: string): number | null {
  const t = normalize(text);
  const n = normalize(q);
  if (!t || !n) return null;
  if (t === n) return 4;
  if (t.startsWith(n)) return 3;
  if ((" " + t).includes(" " + n)) return 2;
  if (t.includes(n)) return 1;
  const words = n.split(" ");
  if (words.length > 1 && words.every((w) => t.includes(w))) return 0.5;
  return null;
}

/** Markdown marks taken out, so a day page's words read as plain text in a result. */
export function stripMarkdown(s: string): string {
  return s
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/(\*\*|__|\*|`)/g, "");
}

/**
 * A few words either side of the first word of the query found in the text, as [before, match, after], with "..." where
 * the text goes on. Matching ignores case and accents; the words shown are the text's own. Null when no word is found.
 */
export function snippetAround(text: string, q: string, radius = 48): [string, string, string] | null {
  const plain = text.replace(/\s+/g, " ").trim();
  // The folded text, and for each of its characters the position of the character it came from.
  let folded = "";
  const from: number[] = [];
  for (let i = 0; i < plain.length; i++) {
    const f = foldChar(plain[i]);
    folded += f;
    for (let k = 0; k < f.length; k++) from.push(i);
  }
  let at = -1;
  let len = 0;
  for (const w of queryWords(q)) {
    const i = folded.indexOf(w);
    if (i >= 0 && (at < 0 || i < at)) {
      at = i;
      len = w.length;
    }
  }
  if (at < 0) return null;
  const start = from[at];
  const end = from[at + len - 1] + 1;

  let a = Math.max(0, start - radius);
  let b = Math.min(plain.length, end + radius);
  // Begin and end on a whole word where the cut falls inside one.
  if (a > 0) {
    const space = plain.indexOf(" ", a);
    a = space >= 0 && space < start ? space + 1 : a;
  }
  if (b < plain.length) {
    const space = plain.lastIndexOf(" ", b);
    b = space > end ? space : b;
  }
  return [(a > 0 ? "..." : "") + plain.slice(a, start), plain.slice(start, end), plain.slice(end, b) + (b < plain.length ? "..." : "")];
}

/** A word made safe inside a LIKE pattern: the pattern characters %, _ and the escape \ match only themselves. */
export function escapeLike(word: string): string {
  return word.replace(/[\\%_]/g, (c) => "\\" + c);
}

/** Accents taken off, one letter at a time ("Hékate" is "Hekate"). The case is left alone: ILIKE does not mind it. */
function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

/**
 * One `%word%` pattern per word of the query as typed, for `ILIKE ALL`: every word must be found. With `foldAccents` the
 * accents are taken off the words, for a database that also takes them off the text (unaccent, migration 072).
 */
export function likePatterns(q: string, foldAccents = false): string[] {
  return cleanQuery(q)
    .split(" ")
    .filter(Boolean)
    .map((w) => `%${escapeLike(foldAccents ? stripAccents(w) : w)}%`);
}

/** A day page asked for by its date (YYYY-MM-DD), or null. */
export function dayFromQuery(q: string, now = new Date()): string | null {
  const c = cleanQuery(q);
  return isValidDay(c, now) ? c : null;
}

/**
 * The person's own day as their device reported it, or today in UTC when it is missing or cannot be right. A device's
 * day is never more than one day from the UTC day (time zones run from UTC-12 to UTC+14), so anything further is wrong.
 */
export function cleanToday(raw: unknown, now = new Date()): string {
  const utc = now.toISOString().slice(0, 10);
  if (typeof raw !== "string" || !isValidDay(raw, now)) return utc;
  const gap = Math.abs(Date.parse(`${raw}T00:00:00Z`) - Date.parse(`${utc}T00:00:00Z`));
  return gap <= 86_400_000 ? raw : utc;
}

const MONTH_NAMES = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const WEEKDAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** A month typed in full or cut short ("oct", "sept", "october"), as 0 to 11, or -1. Three letters at least. */
function monthOf(word: string): number {
  if (word.length < 3) return -1;
  return MONTH_NAMES.findIndex((m) => m.startsWith(word));
}

/** "3", "3rd", "21st" as a day of the month, or 0. */
function dayOfMonth(word: string): number {
  const m = /^(\d{1,2})(st|nd|rd|th)?$/.exec(word);
  const n = m ? Number(m[1]) : 0;
  return n >= 1 && n <= 31 ? n : 0;
}

/**
 * A day page asked for in words, or null. `today` is the person's own day (YYYY-MM-DD) as their device reports it: the
 * server cannot know their time zone. Understood: "today", "yesterday", "tomorrow", "3 days ago", "a week ago", a weekday
 * ("monday", "last monday": the latest one before today, and "monday" on a Monday is today), and a date in words
 * ("3 october", "october 3rd", "3 oct 2025"). Without a year the latest such date that is not after today is meant.
 * English only, like the rest of the app. A date typed as 2026-10-03 is dayFromQuery's.
 */
export function dayFromWords(q: string, today: string): string | null {
  if (!isValidDay(today, new Date(`${today}T12:00:00Z`))) return null;
  const now = new Date(`${today}T12:00:00Z`);
  const words = normalize(q).split(" ").filter((w) => w && w !== "of" && w !== "the");
  if (words.length === 0) return null;
  const text = words.join(" ");
  const valid = (day: string) => (isValidDay(day, now) ? day : null);

  if (text === "today") return today;
  if (text === "yesterday") return valid(addDays(today, -1));
  if (text === "tomorrow") return valid(addDays(today, 1));

  const ago = /^(\d{1,3}|a|an|one) (day|days|week|weeks) ago$/.exec(text);
  if (ago) {
    const n = /^\d/.test(ago[1]) ? Number(ago[1]) : 1;
    return valid(addDays(today, -n * (ago[2].startsWith("week") ? 7 : 1)));
  }

  const weekday = /^(last )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/.exec(text);
  if (weekday) {
    const todayIndex = now.getUTCDay();
    let back = (todayIndex - WEEKDAY_NAMES.indexOf(weekday[2]) + 7) % 7;
    if (weekday[1] && back === 0) back = 7;
    return valid(addDays(today, -back));
  }

  // A day and a month, in either order, then an optional four-digit year.
  let year: number | null = null;
  const parts = [...words];
  const last = parts[parts.length - 1];
  if (parts.length === 3 && /^\d{4}$/.test(last)) {
    year = Number(last);
    parts.pop();
  }
  if (parts.length !== 2) return null;
  let day = dayOfMonth(parts[0]);
  let month = monthOf(parts[1]);
  if (!day || month < 0) {
    day = dayOfMonth(parts[1]);
    month = monthOf(parts[0]);
  }
  if (!day || month < 0) return null;

  const make = (y: number) => {
    const t = new Date(Date.UTC(y, month, day));
    return t.getUTCMonth() === month && t.getUTCDate() === day ? t.toISOString().slice(0, 10) : null;
  };
  if (year !== null) {
    const found = make(year);
    return found ? valid(found) : null;
  }
  const thisYear = now.getUTCFullYear();
  const found = make(thisYear);
  if (found && found <= today) return valid(found);
  // Not yet this year (or 29 February in a year that has none): the last time it came round.
  for (let y = thisYear - 1; y >= thisYear - 8; y--) {
    const earlier = make(y);
    if (earlier) return valid(earlier);
  }
  return null;
}

// ── The shared things kept in code ───────────────────────────────────────────

export interface Entry {
  id: string;
  label: string;
  href: string;
  note?: string;
  /** Other words that find it, matched after the label and ranked below a label match. */
  keywords?: string[];
  adminOnly?: boolean;
  /** Needs a server shared by other people; a local copy does not offer it (lib/edition-features.ts). */
  serverOnly?: boolean;
  noHost?: boolean;
  localOnly?: boolean;
  noFeathered?: boolean;
}

const SUIT_NOTES: Record<Suit, string> = {
  major: "Major arcana",
  cups: "Cups",
  pentacles: "Pentacles",
  swords: "Swords",
  wands: "Wands",
};

/** Other words that find a page from the navigation, by the item's id. */
const PAGE_KEYWORDS: Record<string, string[]> = {
  patterns: ["insights", "themes over time"],
  days: ["calendar", "diary"],
  journals: ["diary", "notes"],
  library: ["encyclopedia", "deck"],
  guide: ["help", "tour"],
  about: ["hekate"],
  forum: ["posts"],
};

function pageEntries(): Entry[] {
  const out: Entry[] = [];
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (!item.href) continue;
      out.push({
        id: `page-${item.id}`,
        label: item.label,
        href: item.href,
        note: group.label,
        keywords: PAGE_KEYWORDS[item.id],
        adminOnly: item.adminOnly,
        serverOnly: item.serverOnly,
        noHost: item.noHost,
        localOnly: item.localOnly,
        noFeathered: item.noFeathered,
      });
    }
  }
  out.push(
    {
      id: "page-today",
      label: "Today",
      href: "/days/today",
      note: "Your writings",
      keywords: ["day page"],
    },
    {
      id: "page-settings",
      label: "Settings",
      href: "/settings",
      note: "Your account",
      keywords: ["reading comfort", "font", "text size", "less motion", "password", "export", "account"],
    },
    {
      id: "page-colours",
      label: "Colours",
      href: "/design",
      note: "Settings",
      keywords: ["colors", "theme", "design"],
    },
    { id: "page-privacy", label: "Privacy", href: "/privacy", note: "Help and about", keywords: ["terms"] },
    { id: "page-sent-feedback", label: "Feedback you have sent", href: "/feedback", note: "Help and about" }
  );
  for (const kind of DIVINATION_KINDS) {
    const start = DIVINATION_KIND_START[kind];
    out.push({
      id: `page-new-${kind}`,
      label: start.label,
      href: start.href,
      note: `Start a new reading: ${DIVINATION_KIND_LABELS[kind]}`,
      keywords: ["new reading"],
    });
  }
  return out;
}

let staticCache: Record<"pages" | "cards" | "runes" | "staves" | "hexagrams" | "figures" | "archetypes", Entry[]> | null = null;

/** The shared things kept in code, built once. */
export function staticEntries() {
  staticCache ??= {
    pages: pageEntries(),
    cards: TAROT_DECK.map((c) => ({
      id: `card-${c.id}`,
      label: c.name,
      href: `/cards/${encodeURIComponent(c.id)}`,
      note: SUIT_NOTES[c.suit],
    })),
    runes: RUNES.map((r) => ({ id: r.id, label: r.name, href: `/runes/set/${r.id}`, note: "Elder Futhark rune" })),
    staves: STAVES.map((s) => ({ id: s.id, label: s.name, href: `/ogham/set/${s.id}`, note: "Ogham stave" })),
    hexagrams: HEXAGRAMS.map((h) => ({
      id: h.id,
      label: `${h.n}. ${h.pinyin}`,
      href: `/iching/set/${h.n}`,
      note: `I Ching · ${h.english}`,
      keywords: [h.english, h.char, `hexagram ${h.n}`],
    })),
    figures: FIGURES.map((x) => ({ id: x.id, label: x.latin, href: `/geomancy/set/${x.id.slice(9)}`, note: `Geomantic figure · ${x.english}` })),
    archetypes: ARCHETYPES.map((a) => ({
      id: `archetype-${a.slug}`,
      label: a.name,
      href: `/archetypes/${a.slug}`,
      note: a.realm,
    })),
  };
  return staticCache;
}

// ── The person's own words for a piece of a tool ─────────────────────────────

/** Where a piece the person wrote about is shown: its name, the tool it belongs to, and the page that holds their words. */
export interface MeaningPiece {
  label: string;
  note: string;
  href: string;
}

/**
 * What a `card_customizations.card_id` stands for: a tarot card ('major-0'), a rune, an ogham stave, a face of a die or a
 * coin ('die-d6-3', 'coin-heads'), or a whole suit or number ('group-suit-cups', 'group-rank-5'). Null for an id the app
 * does not have, so a stray row is never shown. The name and the link are the app's; the person's words are not here.
 */
export function meaningPiece(id: string): MeaningPiece | null {
  const card = TAROT_DECK.find((c) => c.id === id);
  if (card) return { label: card.name, note: `Tarot · ${SUIT_NOTES[card.suit]}`, href: `/cards/${encodeURIComponent(card.id)}` };
  const rune = RUNES.find((r) => r.id === id);
  if (rune) return { label: rune.name, note: "Runes", href: `/runes/set/${rune.id}` };
  const stave = STAVES.find((s) => s.id === id);
  if (stave) return { label: stave.name, note: "Ogham", href: `/ogham/set/${stave.id}` };
  const face = getFace(id);
  if (face) return { label: face.name, note: face.object === "coin" ? "Coin" : "Dice", href: `/dice/set/${face.object}/${face.face}` };
  const hexagram = getHexagram(id);
  if (hexagram) return { label: `${hexagram.n}. ${hexagram.pinyin}`, note: "I Ching", href: `/iching/set/${hexagram.n}` };
  const figure = getFigure(id);
  if (figure) return { label: figure.latin, note: "Geomancy", href: `/geomancy/set/${figure.id.slice(9)}` };
  const playing = cardOfMeaningId(id);
  if (playing) return { label: playing.name, note: "Playing cards", href: `/playingcards/set/${playing.id}` };
  const group = parseGroupNoteId(id);
  if (group) {
    // The words for a whole suit or number are written on every card page of that suit or number; open the first.
    const first = TAROT_DECK.find((c) => (group.kind === "suit" ? c.suit === group.key : c.suit !== "major" && c.id.endsWith(`-${group.key}`)));
    if (!first) return null;
    return {
      label: group.label,
      note: group.kind === "suit" ? "Tarot · your words for a whole suit" : "Tarot · your words for a whole number",
      href: `/cards/${encodeURIComponent(first.id)}`,
    };
  }
  return null;
}

/** The best score of an entry: its label, else a keyword (ranked below any label match). */
function entryScore(e: Entry, q: string): number | null {
  const s = scoreText(e.label, q);
  if (s !== null) return s;
  for (const k of e.keywords ?? []) {
    if (scoreText(k, q) !== null) return 0.25;
  }
  return null;
}

/** The entries that match, best first (ties keep their order), at most `limit`, and whether more matched. */
export function rankEntries(entries: Entry[], q: string, limit = PER_GROUP): { items: SearchItem[]; more: boolean } {
  const hits: { e: Entry; s: number; i: number }[] = [];
  entries.forEach((e, i) => {
    const s = entryScore(e, q);
    if (s !== null) hits.push({ e, s, i });
  });
  hits.sort((x, y) => y.s - x.s || x.i - y.i);
  return {
    items: hits.slice(0, limit).map(({ e }) => ({ id: e.id, label: e.label, href: e.href, note: e.note })),
    more: hits.length > limit,
  };
}

/** The groups of shared things kept in code that match, each with at most PER_GROUP results. Empty groups are left out. */
export function searchStatic(q: string, isAdmin: boolean, edition: Shape = shapeOf()): SearchGroup[] {
  if (cleanQuery(q).length < MIN_QUERY) return [];
  const all = staticEntries();
  const groups: SearchGroup[] = [];
  for (const id of ["pages", "cards", "runes", "staves", "hexagrams", "figures", "archetypes"] as const) {
    const entries = id === "pages" ? all.pages.filter((e) => itemShown(e, isAdmin, edition)) : all[id];
    const { items, more } = rankEntries(entries, q);
    if (items.length) groups.push({ id, label: GROUP_LABELS[id], items, more });
  }
  return groups;
}

/** The groups in GROUP_ORDER, empty ones left out. */
export function orderGroups(groups: SearchGroup[]): SearchGroup[] {
  return GROUP_ORDER.map((id) => groups.find((g) => g.id === id)).filter(
    (g): g is SearchGroup => !!g && g.items.length > 0
  );
}
