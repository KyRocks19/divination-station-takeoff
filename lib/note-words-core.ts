// Words that keep coming back in the person's notes of signs and dreams (open item NT1), for Patterns. A note is the person's own
// writing, so the app has no list of symbols to count; instead it counts the words they used, each note at most once per word, and
// shows a word once it is in three or more notes. Common English words are left out so the list is of things, not grammar. It says
// what is there and never what it means. Pure, so it can be tested without a database.

import type { DivinationKind } from "./divination-kinds";

export const NOTE_WORD_MIN_NOTES = 3;
export const NOTE_WORD_MAX = 20;
export const NOTE_WORD_MAX_ENTRIES = 12;

export interface NoteIn {
  divination_id: number;
  body: string;
  created_at: string;
}

export interface NoteWord {
  word: string;
  /** How many notes have it. */
  count: number;
  /** The latest notes that have it, oldest first. */
  entries: { id: number; when: string }[];
  /** How many earlier notes have it but are not listed. */
  earlier: number;
}

/** The tool whose notes these are, so a page can follow the tools the person shows. */
export const NOTE_WORD_KIND: DivinationKind = "signs";

// Short and common words, and the words most notes of a dream or sign use for themselves. Kept small on purpose: a person's own
// recurring word should not be hidden because it looks ordinary.
const STOP = new Set(
  `about above after again against all also always among and another any anything are around back because been before being below between
  both but came can cannot come could did does doing done down during each else even ever every felt few find first for found from
  get gets getting give going gone got had has have having her here hers herself him himself his how into its itself just keep kept
  know knew last least less let like little look looked looking made make many may maybe more most much must myself near never next
  nothing now off once one only onto other others our ours ourselves out over own really right said same saw say says see seem seemed
  seen she should since some something somehow someone still such sure take than that the their theirs them themselves then there these
  they thing things think this those though thought through thus till too took toward under until upon very want wanted was way well
  went were what whatever when where whether which while who whom whose why will with within without would yes yet you your yours
  yourself yourselves dream dreamed dreamt dreaming dreams sign signs today yesterday night morning time times`.split(/\s+/)
);

/** The words of one note that count: lower case, letters only (accents kept), at least three letters, not a common word. */
export function wordsOf(body: string): Set<string> {
  const out = new Set<string>();
  for (const raw of body.toLowerCase().normalize("NFC").match(/\p{L}+(?:['’]\p{L}+)*/gu) ?? []) {
    const w = raw.replace(/['’]s$/u, "");
    if (w.length >= 3 && !STOP.has(w)) out.add(w);
  }
  return out;
}

/** The words that are in at least NOTE_WORD_MIN_NOTES notes, most notes first, then the most recent, then A to Z. */
export function recurringNoteWords(notes: NoteIn[]): NoteWord[] {
  const byWord = new Map<string, NoteIn[]>();
  for (const n of notes) for (const w of wordsOf(n.body)) byWord.set(w, [...(byWord.get(w) ?? []), n]);
  const out: NoteWord[] = [];
  for (const [word, list] of byWord) {
    if (list.length < NOTE_WORD_MIN_NOTES) continue;
    const dated = [...list].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.divination_id - b.divination_id);
    const shown = dated.slice(-NOTE_WORD_MAX_ENTRIES);
    out.push({ word, count: dated.length, entries: shown.map((n) => ({ id: n.divination_id, when: n.created_at })), earlier: dated.length - shown.length });
  }
  const last = (w: NoteWord) => w.entries[w.entries.length - 1].when;
  return out.sort((a, b) => b.count - a.count || last(b).localeCompare(last(a)) || a.word.localeCompare(b.word)).slice(0, NOTE_WORD_MAX);
}
