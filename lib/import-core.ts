import { getCardById } from "./cards";

// Importing a copy of a person's writing (open item ED6, decided 2026-10-18: every tool, adds only). The file is the JSON the Settings export makes
// (app/api/export). This file holds what needs no database: reading the file, checking every row, the keys that tell a row the person already has,
// and the report. lib/import.ts writes the rows. An import only ever ADDS: a row that is already there is skipped, never replaced, and nothing the
// person has is changed or deleted. Nothing in the file is trusted: every row is checked as if a stranger had typed it.

export type Row = Record<string, unknown>;

export const IMPORT_LIMITS = {
  /** The largest file read, in bytes (the server's request limit is 16 MB). */
  bytes: 14_000_000,
  /** Rows of each kind, so one file cannot fill the database. */
  readings: 5000,
  journalsPerReading: 500,
  rows: 5000,
  text: 20_000,
  title: 300,
  question: 2000,
  name: 200,
} as const;

/** The parts of an export this import knows, in the order it brings them in, with the words for the report. */
export const SECTION_LABELS = {
  // The other parts have their labels beside their code (lib/import-tools.ts).
  tags: "Tags",
  layouts: "Layouts",
  readings: "Tarot readings (with their journals, tags and sky)",
  card_meanings: "Your tarot card meanings (with earlier versions)",
  concept_notes: "Your notes on concepts",
  synthesis_journals: "Synthesis journals",
} as const;
export type SectionId = keyof typeof SECTION_LABELS;

/** Keys of an export that are not brought in, and why. Shown in the report so nobody thinks they were. */
export const NOT_IMPORTED: Record<string, string> = {
  exported_at: "",
  account: "Your account name and sigil stay as they are here.",
  preferences: "Settings stay as you have them here.",
  colours: "Your colours stay as you have them here.",
  circle: "Circle membership belongs to the server you are on and cannot be brought in.",
  recent_searches: "Recent searches stay on the device they were made on.",
  hidden_shared_links: "Shared links you hid for yourself are not brought in yet.",
  kept_divination_takes: "Takes on divination you kept are not brought in yet.",
  own_divination_takes: "Takes on divination you wrote are not brought in yet.",
  companion_questions: "Questions the AI companion asked are not brought in.",
};

export interface SectionReport {
  id: string;
  label: string;
  /** Rows that were new and were (or would be) added. */
  add: number;
  /** Rows the person already has. */
  have: number;
  /** Rows in the file that could not be read or were not allowed, so they were left out. */
  left_out: number;
  /** A line about this section, for example why rows were left out. */
  note?: string;
}

export interface ImportReport {
  /** True when the rows were written; false for a check that wrote nothing. */
  applied: boolean;
  sections: SectionReport[];
  /** Parts of the file this version does not bring in, with the reason. */
  not_imported: { key: string; why: string }[];
}

/** Counts a section as it goes. */
export class Tally {
  readonly report: SectionReport;
  constructor(id: string, label: string) {
    this.report = { id, label, add: 0, have: 0, left_out: 0 };
  }
  added(n = 1) { this.report.add += n; }
  had(n = 1) { this.report.have += n; }
  out(n = 1, note?: string) {
    this.report.left_out += n;
    if (note && !this.report.note) this.report.note = note;
  }
}

// ── Reading the file ─────────────────────────────────────────────────────────────────────────────────

/** The export's JSON, parsed and checked to be one, or the plain sentence saying what is wrong. */
export function parseExportFile(text: unknown): { ok: true; data: Row } | { ok: false; error: string } {
  if (typeof text !== "string" || !text.trim()) return { ok: false, error: "The file is empty." };
  if (text.length > IMPORT_LIMITS.bytes) return { ok: false, error: "The file is too large to bring in at once. It may hold many pictures: export without them, or bring in a smaller file." };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "That is not a Divination Station export. Use the .json file from Settings, \"Download everything\"." };
  }
  return checkExport(data);
}

const KNOWN_KEYS = ["readings", "card_meanings", "concept_notes", "synthesis_journals", "layouts", "tags", "days", "oracle_decks", "other_tool_readings", "own_meanings", "pendulum_swings", "predictions"];

/** An already parsed export, or the sentence saying what is wrong. */
export function checkExport(data: unknown): { ok: true; data: Row } | { ok: false; error: string } {
  if (!data || typeof data !== "object" || Array.isArray(data)) return { ok: false, error: "That is not a Divination Station export." };
  const row = data as Row;
  if (!KNOWN_KEYS.some((k) => k in row)) return { ok: false, error: "That file has none of the parts an export has. Use the .json file from Settings, \"Download everything\"." };
  return { ok: true, data: row };
}

/** A list from the file, capped, or an empty list when it is not one. */
export function listOf(value: unknown, max: number = IMPORT_LIMITS.rows): Row[] {
  return Array.isArray(value) ? (value.filter((v) => v && typeof v === "object" && !Array.isArray(v)).slice(0, max) as Row[]) : [];
}

/** How many rows a part of the file has beyond the cap (they are left out, and the report says so). */
export const overCap = (value: unknown, max: number = IMPORT_LIMITS.rows) => (Array.isArray(value) ? Math.max(0, value.length - max) : 0);

/** Text, cut to `max`, or null when it is not text. Spaces are kept: it is the person's own writing. */
export function text(value: unknown, max: number = IMPORT_LIMITS.text): string | null {
  return typeof value === "string" ? value.replace(/\r\n?/g, "\n").slice(0, max) : null;
}

/** A name or title: tidied to one line, or null when it is empty or not text. */
export function oneLine(value: unknown, max: number = IMPORT_LIMITS.name): string | null {
  if (typeof value !== "string") return null;
  const t = value.replace(/\s+/g, " ").trim().slice(0, max);
  return t || null;
}

/** A date from the file as an ISO time, or null. Dates before 1990 or after a day from now are not believed. */
export function isoDate(value: unknown, now = Date.now()): string | null {
  if (typeof value !== "string" && !(value instanceof Date)) return null;
  const t = new Date(value).getTime();
  return Number.isFinite(t) && t >= Date.UTC(1990, 0, 1) && t <= now + 86_400_000 ? new Date(t).toISOString() : null;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
export const hexOrNull = (v: unknown) => (typeof v === "string" && HEX.test(v) ? v.toLowerCase() : null);

// ── Tarot readings ───────────────────────────────────────────────────────────────────────────────────

export interface DrawnCardIn {
  position: string;
  card_id: string;
  card_name: string;
  reversed: boolean;
  color?: string;
}

/** One drawn card as the file holds it: a card that is in the deck, with its position. Null when it is not usable. */
export function cleanDrawnCard(raw: unknown): DrawnCardIn | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Row;
  const id = typeof r.card_id === "string" ? r.card_id : "";
  const card = getCardById(id);
  if (!card) return null;
  const color = hexOrNull(r.color);
  return { position: oneLine(r.position, 100) ?? "", card_id: card.id, card_name: card.name, reversed: r.reversed === true, ...(color ? { color } : {}) };
}

export const MAX_CARDS = 120;

export function cleanCards(raw: unknown): DrawnCardIn[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_CARDS) return null;
  const out: DrawnCardIn[] = [];
  for (const c of raw) {
    const card = cleanDrawnCard(c);
    if (!card) return null;
    out.push(card);
  }
  return out;
}

/** Clarifier cards by the index of the card they clarify; an entry that cannot be read, or points at a card that is not there, is dropped. */
export function cleanClarifiers(raw: unknown, cardCount: number): Record<number, DrawnCardIn[]> {
  const out: Record<number, DrawnCardIn[]> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Row)) {
    const i = Number(k);
    if (!Number.isInteger(i) || i < 0 || i >= cardCount || !Array.isArray(v)) continue;
    const list = v.map(cleanDrawnCard).filter((c): c is DrawnCardIn => c !== null).slice(0, 20);
    if (list.length) out[i] = list;
  }
  return out;
}

/** What a stored sky snapshot is, from the export's sky. Only a sky that was recorded at the time is kept; one worked out from the date is left to be worked out again. */
export function skyToStore(sky: unknown): string | null {
  if (!sky || typeof sky !== "object") return null;
  const { recorded, ...rest } = sky as Row;
  if (recorded !== true) return null;
  const json = JSON.stringify(rest);
  return json.length <= 4000 ? json : null;
}

export interface ReadingIn {
  created_at: string;
  spread_name: string;
  title: string | null;
  question: string | null;
  notes: string | null;
  sky: string | null;
  cards: DrawnCardIn[];
  clarifiers: Record<number, DrawnCardIn[]>;
  tags: string[];
  journals: JournalIn[];
  /** Drawn with the person's own deck and recorded (migration 106). */
  own_draw: boolean;
}

export interface JournalIn {
  created_at: string;
  author: string;
  kind: string;
  card_index: number | null;
  clarifier_index: number | null;
  card_id: string | null;
  content: string;
}

/** The authors a journal entry can have, as the app writes them ("sword" entries from before 2026-10-17 are kept as they were). */
const AUTHORS = new Set(["user", "hiero", "claude", "guide", "sword", "interview"]);
const KINDS = new Set(["note", "impression", "lookback"]);

export function cleanJournal(raw: unknown, cardCount: number): JournalIn | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Row;
  const created = isoDate(r.created_at);
  const content = text(r.content);
  if (!created || !content || !content.trim()) return null;
  const author = typeof r.author === "string" && AUTHORS.has(r.author) ? r.author : "user";
  const kind = typeof r.kind === "string" && KINDS.has(r.kind) ? r.kind : "note";
  const idx = (v: unknown, below: number) => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < below ? v : null);
  const cardId = typeof r.card_id === "string" && getCardById(r.card_id) ? r.card_id : null;
  // A clarifier index counts the clarifiers drawn for one card, not the cards of the reading.
  return { created_at: created, author, kind, card_index: idx(r.card_index, cardCount), clarifier_index: idx(r.clarifier_index, 20), card_id: cardId, content };
}

export function cleanReading(raw: unknown): ReadingIn | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Row;
  const created = isoDate(r.created_at);
  const cards = cleanCards(r.cards);
  const spread = oneLine(r.spread_name, 200);
  if (!created || !cards || !spread) return null;
  const tags = (Array.isArray(r.tags) ? r.tags : []).map((t) => oneLine(t, 100)).filter((t): t is string => t !== null).slice(0, 50);
  const journals = (Array.isArray(r.journals) ? r.journals : []).slice(0, IMPORT_LIMITS.journalsPerReading).map((j) => cleanJournal(j, cards.length)).filter((j): j is JournalIn => j !== null);
  return {
    created_at: created,
    spread_name: spread,
    title: oneLine(r.title, IMPORT_LIMITS.title),
    question: text(r.question, IMPORT_LIMITS.question)?.trim() || null,
    notes: text(r.notes)?.trim() || null,
    sky: skyToStore(r.sky),
    cards,
    clarifiers: cleanClarifiers(r.clarifiers, cards.length),
    // A tag is the same tag whatever its capitals, as in the rest of the app.
    tags: tags.filter((t, i) => tags.findIndex((u) => u.toLowerCase() === t.toLowerCase()) === i),
    journals,
    own_draw: r.own_draw === true,
  };
}

/** What tells a reading the person already has from a new one: the moment (to the second), the spread and the cards in their places. */
export function readingKey(r: { created_at: string | Date; spread_name: string; cards: { card_id: string; position: string; reversed: boolean }[] }): string {
  const at = new Date(r.created_at).toISOString().slice(0, 19);
  return `${at}|${r.spread_name.trim().toLowerCase()}|${r.cards.map((c) => `${c.card_id}:${c.position}:${c.reversed ? 1 : 0}`).join(",")}`;
}

/** A journal entry's key within one reading: the moment, who wrote it, and the words. */
export const journalKey = (j: { created_at: string | Date; author: string; content: string }) => `${new Date(j.created_at).toISOString().slice(0, 19)}|${j.author}|${j.content.trim()}`;

// ── Meanings, notes, layouts, tags ───────────────────────────────────────────────────────────────────

export interface MeaningIn {
  upright_keywords: string | null;
  reversed_keywords: string | null;
  upright_description: string | null;
  reversed_description: string | null;
}

/** A meaning in the export's shape (`uprightKeywords` ...). Null when every field is empty. */
export function cleanMeaning(raw: unknown): MeaningIn | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Row;
  const m: MeaningIn = {
    upright_keywords: text(r.uprightKeywords ?? r.keywords, 2000)?.trim() || null,
    reversed_keywords: text(r.reversedKeywords ?? r.upside_down_keywords, 2000)?.trim() || null,
    upright_description: text(r.uprightDescription ?? r.description, IMPORT_LIMITS.text)?.trim() || null,
    reversed_description: text(r.reversedDescription ?? r.upside_down_description, IMPORT_LIMITS.text)?.trim() || null,
  };
  return Object.values(m).some(Boolean) ? m : null;
}

export interface CardMeaningIn {
  card_id: string;
  current: (MeaningIn & { updated_at: string }) | null;
  history: (MeaningIn & { saved_at: string })[];
}

export function cleanCardMeaning(raw: unknown): CardMeaningIn | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Row;
  const card = typeof r.card_id === "string" ? getCardById(r.card_id) : undefined;
  if (!card) return null;
  const cur = cleanMeaning(r.current);
  const current = cur ? { ...cur, updated_at: isoDate(r.updated_at) ?? new Date().toISOString() } : null;
  const history = (Array.isArray(r.history) ? r.history : []).slice(0, 200).flatMap((h) => {
    const m = cleanMeaning(h);
    const at = h && typeof h === "object" ? isoDate((h as Row).saved_at) : null;
    return m && at ? [{ ...m, saved_at: at }] : [];
  });
  return current || history.length ? { card_id: card.id, current, history } : null;
}

export interface LayoutIn {
  name: string;
  description: string | null;
  question: string | null;
  created_at: string;
  positions: { name: string; prompt: string | null; color: string | null; x: number | null; y: number | null; rotation: number | null }[];
}

const MAX_POSITIONS = 120;

export function cleanLayout(raw: unknown): LayoutIn | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Row;
  const name = oneLine(r.name, 200);
  if (!name || !Array.isArray(r.positions) || r.positions.length === 0 || r.positions.length > MAX_POSITIONS) return null;
  const num = (v: unknown, hi: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= hi ? Math.round(v) : null);
  const positions = [];
  for (const p of r.positions) {
    if (!p || typeof p !== "object") return null;
    const pr = p as Row;
    const pn = oneLine(pr.name, 200);
    if (!pn) return null;
    positions.push({ name: pn, prompt: text(pr.prompt, 2000)?.trim() || null, color: hexOrNull(pr.color), x: num(pr.x, 5000), y: num(pr.y, 5000), rotation: num(pr.rotation, 359) });
  }
  // The rules of the layout editor: a place on the board needs both numbers, and either every position has one or none does. A layout that breaks
  // them comes in as a plain list rather than being refused.
  for (const p of positions) if (p.x === null || p.y === null) { p.x = null; p.y = null; p.rotation = null; }
  if (positions.some((p) => p.x === null)) for (const p of positions) { p.x = null; p.y = null; p.rotation = null; }
  for (const p of positions) if (p.x !== null && p.rotation === null) p.rotation = 0;
  return { name, description: text(r.description, 2000)?.trim() || null, question: text(r.question, 2000)?.trim() || null, created_at: isoDate(r.created_at) ?? new Date().toISOString(), positions };
}

export function cleanTagRow(raw: unknown): { name: string; color: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Row;
  const name = oneLine(r.name, 100);
  return name ? { name, color: hexOrNull(r.color) ?? "#7c3aed" } : null;
}

export interface ConceptNoteIn {
  concept: string;
  content: string;
  updated_at: string;
}

export function cleanConceptNote(raw: unknown): ConceptNoteIn | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Row;
  const concept = oneLine(r.concept, 200);
  const content = text(r.content)?.trim();
  return concept && content ? { concept, content, updated_at: isoDate(r.updated_at) ?? new Date().toISOString() } : null;
}

export interface SynthesisIn {
  prompt: string;
  content: string;
  created_at: string;
}

export function cleanSynthesis(raw: unknown): SynthesisIn | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Row;
  const prompt = text(r.prompt, 4000)?.trim();
  const content = text(r.content, 40_000)?.trim();
  const created = isoDate(r.created_at);
  return prompt && content && created ? { prompt, content, created_at: created } : null;
}

/** The parts of the file this version does not bring in, with the reason, for the report. */
export function notImported(data: Row, imported: string[]): { key: string; why: string }[] {
  return Object.keys(data)
    .filter((k) => !imported.includes(k))
    .map((k) => ({ key: k, why: NOT_IMPORTED[k] ?? "Not brought in by this version yet." }))
    .filter((n) => n.why !== "" && !(Array.isArray(data[n.key]) && (data[n.key] as unknown[]).length === 0));
}
