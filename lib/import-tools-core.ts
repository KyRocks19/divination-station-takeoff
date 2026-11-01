import { RUNES } from "./runes-data";
import { STAVES } from "./ogham-data";
import { facesOf, getObject, type DiceObjectId } from "./dice-data";
import { isKnownSymbolId } from "./symbol-ids";
import { CAST_METHODS as ICHING_METHODS, cleanLineValues, linesToText, type CastMethod as IChingMethod } from "./iching-data";
import { mothersFromText } from "./geomancy-data";
import { isScryingSurface, cleanMinutes } from "./scrying-surfaces";
import { cleanForm, type SetForm } from "./oracle-forms";
import { PLAYING_CARDS } from "./playingcards-data";
import { isNoteType, cleanNoteBody, cleanDay as cleanNoteDay, type NoteType } from "./signs-core";
import { cleanOptions, cleanImpression, DAILY_SHAPES, IDEOGRAM_FORM } from "./remoteview-core";
import { cleanSeed, type Vessel } from "./blots-core";
import { isTeaKind, type TeaKind } from "./tea-core";
import { cleanDrawing, type Drawing } from "./oracle-art";
import { cleanCloth, cleanZone, type Zone } from "./cloth-core";
import { cleanArchetype, cleanConcept } from "./own-archetypes-core";
import { isItemKind } from "./days-core";
import { OUTCOMES } from "./prediction-words";
import { cleanOwnName, canNamePiece } from "./own-names-core";
import { cleanStyleName, cleanStyleText } from "./art-styles-core";
import {
  IMPORT_LIMITS, hexOrNull, isoDate, oneLine, text, cleanMeaning, type MeaningIn, type Row,
} from "./import-core";

// The cleaners for the other tools' parts of an export (open item ED6, part 2): each takes one row from the file and returns it checked and tidied,
// or null when it cannot be used. No database. The rules are the app's own (the same limits and lists), so an imported row is one the app could have made.

const KINDS = ["runes", "ogham", "dice", "oracle", "scrying", "pendulum", "iching", "geomancy", "bibliomancy", "playingcards", "charms", "signs", "remoteview", "tea", "blots"] as const;
export type ToolKind = (typeof KINDS)[number];

const JOURNAL_AUTHORS = new Set(["user", "hiero", "claude", "guide", "sword", "interview"]);
const JOURNAL_KINDS = new Set(["note", "impression", "lookback"]);

export interface ToolJournalIn {
  created_at: string;
  author: string;
  kind: string;
  content: string;
}

function cleanToolJournals(raw: unknown): ToolJournalIn[] {
  const out: ToolJournalIn[] = [];
  for (const j of (Array.isArray(raw) ? raw : []).slice(0, IMPORT_LIMITS.journalsPerReading)) {
    if (!j || typeof j !== "object") continue;
    const r = j as Row;
    const created = isoDate(r.created_at);
    const content = text(r.content);
    if (!created || !content?.trim()) continue;
    out.push({
      created_at: created,
      author: typeof r.author === "string" && JOURNAL_AUTHORS.has(r.author) ? r.author : "user",
      kind: typeof r.kind === "string" && JOURNAL_KINDS.has(r.kind) ? r.kind : "note",
      content,
    });
  }
  return out;
}

// ── The person's own meanings for runes, ogham staves and dice faces ─────────────────────────────────

const PERSONAL_PREFIXES = ["rune-", "ogham-", "die-", "coin-", "hexagram-", "geomancy-"];

export interface OwnMeaningIn {
  symbol: string;
  current: (MeaningIn & { updated_at: string }) | null;
  history: (MeaningIn & { saved_at: string })[];
}

export function cleanOwnMeaning(raw: unknown): OwnMeaningIn | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Row;
  const symbol = typeof r.symbol === "string" ? r.symbol : "";
  if (!PERSONAL_PREFIXES.some((p) => symbol.startsWith(p)) || !isKnownSymbolId(symbol)) return null;
  const cur = cleanMeaning(r.current);
  const current = cur ? { ...cur, updated_at: isoDate((r.current as Row).updated_at) ?? new Date().toISOString() } : null;
  const history = (Array.isArray(r.earlier_versions) ? r.earlier_versions : []).slice(0, 200).flatMap((h) => {
    const m = cleanMeaning(h);
    const at = h && typeof h === "object" ? isoDate((h as Row).saved_at) : null;
    return m && at ? [{ ...m, saved_at: at }] : [];
  });
  return current || history.length ? { symbol, current, history } : null;
}

// ── Pendulum swings ──────────────────────────────────────────────────────────────────────────────────

const SHAPES = ["line", "circle_cw", "circle_ccw", "still"] as const;

export interface SwingIn {
  shape: string;
  /** Whole degrees, or null for a shape with no angle. */
  angle: number | null;
  tenths: number;
  name: string | null;
  in_play: boolean;
  meaning: string | null;
  history: { saved_at: string; content: string }[];
}

/** An angle as the export writes it (whole degrees plus tenths in one number) as the two columns the app keeps. */
export function splitExportAngle(value: unknown): { angle: number | null; tenths: number } | null {
  if (value === null || value === undefined) return { angle: null, tenths: 0 };
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 179.9) return null;
  const whole = Math.floor(value + 1e-9);
  return { angle: whole, tenths: Math.round((value - whole) * 10) };
}

export function cleanSwing(raw: unknown): SwingIn | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Row;
  if (typeof r.shape !== "string" || !(SHAPES as readonly string[]).includes(r.shape)) return null;
  const a = splitExportAngle(r.angle);
  if (!a || (r.shape === "line" && a.angle === null)) return null;
  const history = (Array.isArray(r.earlier_wordings) ? r.earlier_wordings : []).slice(0, 200).flatMap((h) => {
    const at = h && typeof h === "object" ? isoDate((h as Row).saved_at) : null;
    const content = h && typeof h === "object" ? text((h as Row).content, 2000)?.trim() : null;
    return at && content ? [{ saved_at: at, content }] : [];
  });
  return { shape: r.shape, angle: r.shape === "line" ? a.angle : null, tenths: r.shape === "line" ? a.tenths : 0, name: oneLine(r.name, 80), in_play: r.in_play !== false, meaning: text(r.your_words, 2000)?.trim() || null, history };
}

/** What tells a swing the person already has from a new one: its shape and angle. */
export const swingKey = (s: { shape: string; angle: number | null; tenths: number }) => `${s.shape}|${s.angle ?? ""}|${s.tenths}`;

// ── Readings of the other tools ──────────────────────────────────────────────────────────────────────

export type ToolDetail =
  | { kind: "runes"; items: { id: string; name: string; reversed: boolean; position: string | null }[] }
  | { kind: "ogham"; items: { id: string; name: string; position: string | null }[] }
  | { kind: "dice"; items: { object: DiceObjectId; face: string; position: string | null }[] }
  | { kind: "oracle"; deck: string; cards: { name: string; reversed: boolean; position: string | null }[] }
  | { kind: "scrying"; surface: string; minutes: number | null }
  | { kind: "iching"; method: IChingMethod; lines: string }
  | { kind: "geomancy"; method: "random" | "entered"; mothers: string }
  | { kind: "bibliomancy"; pulls: { unit: "word" | "phrase" | "sentence"; passage: string; context: string | null; source_kind: string; source_label: string; source_when: string | null }[] }
  | { kind: "playingcards"; cards: { id: string; name: string }[] }
  | { kind: "charms"; set: string; charms: { name: string; face: "up" | "down"; x: number; y: number }[] }
  | { kind: "tea"; vessel: "cup"; seed: number; tea: TeaKind | null }
  | { kind: "blots"; vessel: "ink"; seed: number; tea: null }
  | { kind: "signs"; type: NoteType; body: string; day: string | null }
  | { kind: "remoteview"; impression: string; ideogram: Drawing | null; options: string[]; target: number; choice: number }
  | { kind: "pendulum"; swing: { name: string; shape: string; angle: number | null; tenths: number; meaning: string | null; chosen_by: string; motion_shape: string | null; motion_angle: number | null } };

export interface ToolReadingIn {
  created_at: string;
  title: string | null;
  question: string | null;
  summary: string;
  layout_name: string | null;
  sky: string | null;
  detail: ToolDetail;
  journals: ToolJournalIn[];
  /** The names of the tags the reading carried (the person's own tags are matched by name). */
  tags: string[];
}

const lowerName = (s: string) => s.trim().toLowerCase();
const MAX_ITEMS = 120;

function storedSky(raw: unknown): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const json = JSON.stringify(raw);
  return json.length <= 4000 ? json : null;
}

export function cleanToolReading(raw: unknown): ToolReadingIn | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Row;
  const kind = typeof r.tool === "string" && (KINDS as readonly string[]).includes(r.tool) ? (r.tool as ToolKind) : null;
  const created = isoDate(r.created_at);
  if (!kind || !created) return null;
  const position = (v: unknown) => oneLine(v, 100);
  let detail: ToolDetail | null = null;
  const list = (v: unknown) => (Array.isArray(v) ? v.slice(0, MAX_ITEMS) : null);
  if (kind === "runes") {
    const src = list(r.runes);
    const items = (src ?? []).flatMap((x) => {
      const o = (x ?? {}) as Row;
      const rune = typeof o.name === "string" ? RUNES.find((u) => lowerName(u.name) === lowerName(o.name as string)) : undefined;
      return rune ? [{ id: rune.id, name: rune.name, reversed: o.upside_down === true, position: position(o.position) }] : [];
    });
    if (items.length && items.length === src!.length) detail = { kind, items };
  } else if (kind === "ogham") {
    const src = list(r.staves);
    const items = (src ?? []).flatMap((x) => {
      const o = (x ?? {}) as Row;
      const stave = typeof o.name === "string" ? STAVES.find((u) => lowerName(u.name) === lowerName(o.name as string)) : undefined;
      return stave ? [{ id: stave.id, name: stave.name, position: position(o.position) }] : [];
    });
    if (items.length && items.length === src!.length) detail = { kind, items };
  } else if (kind === "dice") {
    const src = list(r.results);
    const items = (src ?? []).flatMap((x) => {
      const o = (x ?? {}) as Row;
      const obj = typeof o.object === "string" ? getObject(o.object) : undefined;
      const face = typeof o.face === "string" ? o.face : "";
      return obj && facesOf(obj.id).includes(face) ? [{ object: obj.id, face, position: position(o.position) }] : [];
    });
    if (items.length && items.length === src!.length) detail = { kind, items };
  } else if (kind === "oracle") {
    const src = list(r.cards);
    const deck = oneLine(r.deck, 200);
    const cards = (src ?? []).flatMap((x) => {
      const o = (x ?? {}) as Row;
      const name = oneLine(o.name, 200);
      return name ? [{ name, reversed: o.upside_down === true, position: position(o.position) }] : [];
    });
    if (deck && cards.length && cards.length === src!.length) detail = { kind, deck, cards };
  } else if (kind === "iching") {
    const c = (r.cast && typeof r.cast === "object" ? r.cast : {}) as Row;
    const values = cleanLineValues(c.lines_from_the_bottom);
    const method = (ICHING_METHODS as readonly string[]).includes(c.how as string) ? (c.how as IChingMethod) : null;
    if (values && method) detail = { kind, method, lines: linesToText(values) };
  } else if (kind === "geomancy") {
    const c = (r.chart && typeof r.chart === "object" ? r.chart : {}) as Row;
    const dots = Array.isArray(c.mothers_as_dots) ? c.mothers_as_dots.join("") : "";
    if (mothersFromText(dots) && (c.how === "random" || c.how === "entered")) detail = { kind, method: c.how, mothers: dots };
  } else if (kind === "bibliomancy") {
    const src = list(r.pulls);
    const pulls = (src ?? []).flatMap((x) => {
      const o = (x ?? {}) as Row;
      const unit = o.unit === "word" || o.unit === "phrase" || o.unit === "sentence" ? (o.unit as "word" | "phrase" | "sentence") : null;
      const passage = text(o.passage, 2000)?.trim();
      const label = oneLine(o.found_in, 200);
      if (!unit || !passage || !label) return [];
      return [{
        unit, passage, context: text(o.sentence_around_it, 1000)?.trim() || null,
        source_kind: typeof o.kind_of_writing === "string" && /^[a-z]{2,20}$/.test(o.kind_of_writing) ? o.kind_of_writing : "own",
        source_label: label, source_when: isoDate(o.written_at),
      }];
    });
    if (pulls.length && pulls.length === src!.length) detail = { kind, pulls };
  } else if (kind === "playingcards") {
    const src = list(r.cards);
    const cards = (src ?? []).flatMap((x) => {
      const name = x && typeof x === "object" && typeof (x as Row).card === "string" ? ((x as Row).card as string).trim().toLowerCase() : "";
      const card = PLAYING_CARDS.find((c) => c.name.toLowerCase() === name);
      return card ? [{ id: card.id, name: card.name }] : [];
    });
    if (cards.length && cards.length === src!.length) detail = { kind, cards };
  } else if (kind === "charms") {
    const src = list(r.charms);
    const within = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 1000 ? v : null);
    const sets = new Set<string>();
    const charms = (src ?? []).flatMap((x) => {
      const o = (x ?? {}) as Row;
      const set = oneLine(o.set, 200);
      const name = oneLine(o.charm, 200);
      const px = within(o.across_0_to_1000);
      const py = within(o.down_0_to_1000);
      if (!set || !name || px === null || py === null || (o.face !== "up" && o.face !== "down")) return [];
      sets.add(set);
      return [{ name, face: o.face as "up" | "down", x: px, y: py }];
    });
    if (charms.length && charms.length === src!.length && sets.size === 1) detail = { kind, set: [...sets][0], charms };
  } else if (kind === "tea" || kind === "blots") {
    // The shape decides the tool: a file made before the split (2026-10-29) has its cups under "blots", and they come in as tasseomancy.
    const s = (r.shape && typeof r.shape === "object" ? r.shape : {}) as Row;
    const vessel: Vessel | null = s.kind === "tea leaves in a cup" ? "cup" : s.kind === "ink blot" ? "ink" : null;
    const seed = cleanSeed(s.seed);
    if (vessel && seed !== null) detail = vessel === "cup" ? { kind: "tea", vessel, seed, tea: isTeaKind(s.tea) ? s.tea : null } : { kind: "blots", vessel, seed, tea: null };
  } else if (kind === "signs") {
    const n = (r.note && typeof r.note === "object" ? r.note : {}) as Row;
    const body = cleanNoteBody(n.text);
    const day = cleanNoteDay(n.happened_on);
    if (isNoteType(n.type) && body && day !== undefined) detail = { kind, type: n.type, body, day };
  } else if (kind === "remoteview") {
    // Only a judged trial is exported with its options and target, so only a judged trial is imported; one still waiting is left out.
    const t = (r.trial && typeof r.trial === "object" ? r.trial : {}) as Row;
    const options = cleanOptions(t.options);
    const impression = cleanImpression(t.impression);
    const target = typeof t.target_number === "number" ? t.target_number - 1 : -1;
    const choice = typeof t.your_choice_number === "number" ? t.your_choice_number - 1 : -1;
    let ideogram: Drawing | null = null;
    if (t.ideogram) {
      const d = cleanDrawing(t.ideogram, IDEOGRAM_FORM);
      if (d.ok) ideogram = d.drawing;
    }
    if (options && impression && Number.isInteger(target) && target >= 0 && target < 4 && Number.isInteger(choice) && choice >= 0 && choice < 4) {
      detail = { kind, impression, ideogram, options, target, choice };
    }
  } else if (kind === "scrying") {
    if (isScryingSurface(r.surface)) detail = { kind, surface: r.surface, minutes: cleanMinutes(r.minutes_looked) };
  } else if (kind === "pendulum" && r.swing && typeof r.swing === "object") {
    const s = r.swing as Row;
    const a = splitExportAngle(s.angle);
    const name = oneLine(s.name, 80);
    if (a && name && typeof s.shape === "string" && (SHAPES as readonly string[]).includes(s.shape)) {
      const moved = s.phone_movement && typeof s.phone_movement === "object" ? (s.phone_movement as Row) : null;
      const motionAngle = moved && typeof moved.angle === "number" && Number.isInteger(moved.angle) && moved.angle >= 0 && moved.angle < 180 ? moved.angle : null;
      detail = {
        kind,
        swing: {
          name, shape: s.shape, angle: a.angle, tenths: a.tenths, meaning: text(s.your_words_then, 2000)?.trim() || null,
          chosen_by: s.chosen_by === "motion" ? "motion" : "chance",
          motion_shape: moved && typeof moved.shape === "string" && (SHAPES as readonly string[]).includes(moved.shape) ? moved.shape : null,
          motion_angle: motionAngle,
        },
      };
    }
  }
  if (!detail) return null;
  return {
    created_at: created,
    title: oneLine(r.title, IMPORT_LIMITS.title),
    question: text(r.question, IMPORT_LIMITS.question)?.trim() || null,
    summary: (oneLine(r.summary, 1000) ?? "").slice(0, 1000),
    layout_name: oneLine(r.layout, 200),
    sky: storedSky(r.sky),
    detail,
    journals: cleanToolJournals(r.journals),
    tags: (Array.isArray(r.tags) ? r.tags : []).slice(0, 20).flatMap((t) => (typeof t === "string" && t.trim() && t.trim().length <= 60 ? [t.trim()] : [])),
  };
}

/** What tells a reading of another tool the person already has from a new one: the tool, the moment (to the second) and what came up. */
export const toolReadingKey = (r: { kind: string; created_at: string | Date; summary: string }) => `${r.kind}|${new Date(r.created_at).toISOString().slice(0, 19)}|${r.summary.trim().toLowerCase()}`;

// ── The person's own oracle sets ─────────────────────────────────────────────────────────────────────

export interface DeckIn {
  name: string;
  description: string | null;
  form: SetForm;
  reversals: boolean;
  reversal_chance: number;
  created_at: string;
  art_style: string | null;
  cards: {
    name: string;
    origin: string | null;
    resting: boolean;
    fields: { name: string; value: string | null }[];
    meanings: { label: string | null; content: string; reversed: boolean; updated_at: string; history: { saved_at: string; label: string | null; content: string }[] }[];
    picture: boolean;
  }[];
}

const MAX_DECK_CARDS = 500;

export function cleanDeck(raw: unknown): DeckIn | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Row;
  const name = oneLine(r.name, 200);
  if (!name) return null;
  const form = r.made_of === undefined ? "cards" : cleanForm(r.made_of);
  if (!form) return null;
  const chance = typeof r.upside_down_chance === "number" && Number.isInteger(r.upside_down_chance) && r.upside_down_chance >= 0 && r.upside_down_chance <= 100 ? r.upside_down_chance : 50;
  const cards = [];
  for (const c of (Array.isArray(r.cards) ? r.cards : []).slice(0, MAX_DECK_CARDS)) {
    if (!c || typeof c !== "object") continue;
    const cr = c as Row;
    const cname = oneLine(cr.name, 200);
    if (!cname) continue;
    const fields = (Array.isArray(cr.fields) ? cr.fields : []).slice(0, 50).flatMap((f) => {
      const fr = (f ?? {}) as Row;
      const fname = oneLine(fr.name, 100);
      return fname ? [{ name: fname, value: text(fr.value, 5000)?.trim() || null }] : [];
    });
    const meanings = (Array.isArray(cr.meanings) ? cr.meanings : []).slice(0, 50).flatMap((m) => {
      const mr = (m ?? {}) as Row;
      const content = text(mr.content, IMPORT_LIMITS.text);
      if (content === null) return [];
      const history = (Array.isArray(mr.earlier_versions) ? mr.earlier_versions : []).slice(0, 100).flatMap((h) => {
        const hr = (h ?? {}) as Row;
        const at = isoDate(hr.saved_at);
        const hc = text(hr.content, IMPORT_LIMITS.text);
        return at && hc !== null ? [{ saved_at: at, label: oneLine(hr.label, 100), content: hc }] : [];
      });
      return [{ label: oneLine(mr.label, 100), content, reversed: mr.for_upside_down_card === true, updated_at: isoDate(mr.updated_at) ?? new Date().toISOString(), history }];
    });
    cards.push({ name: cname, origin: text(cr.where_it_comes_from, 2000)?.trim() || null, resting: cr.resting === true, fields, meanings, picture: !!cr.picture });
  }
  return {
    name,
    description: text(r.description, 2000)?.trim() || null,
    form,
    reversals: r.cards_can_land_upside_down === true,
    reversal_chance: chance,
    created_at: isoDate(r.created_at) ?? new Date().toISOString(),
    art_style: cleanStyleText(r.picture_style_note) ?? null,
    cards,
  };
}

// ── Predictions ──────────────────────────────────────────────────────────────────────────────────────

export interface PredictionIn {
  tool: string;
  reading: string;
  written_at: string;
  first_words: string;
  current_words: string;
  look_back_on: string | null;
  outcome: string | null;
  outcome_note: string | null;
  resolved_at: string | null;
}

export function cleanPrediction(raw: unknown): PredictionIn | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Row;
  const written = isoDate(r.written_at);
  const first = text(r.first_words, 4000)?.trim();
  const current = text(r.current_words, 4000)?.trim() || first;
  const tool = typeof r.tool === "string" ? r.tool : "";
  const reading = oneLine(r.reading, 1000);
  if (!written || !first || !current || !tool || !reading) return null;
  const on = typeof r.look_back_on === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.look_back_on) && Number.isFinite(new Date(r.look_back_on).getTime()) ? r.look_back_on : null;
  const outcome = typeof r.what_happened === "string" && (OUTCOMES as readonly string[]).includes(r.what_happened) ? r.what_happened : null;
  return {
    tool, reading, written_at: written, first_words: first, current_words: current, look_back_on: on, outcome,
    // An answer needs the moment it was given; if the file lacks it, the moment the prediction was written stands in.
    outcome_note: text(r.in_your_words, 4000)?.trim() || null, resolved_at: outcome ? isoDate(r.looked_back_at) ?? written : null,
  };
}

// ── First guesses ("write what you sense first", migration 090) ──────────────────────────────────────

export interface GuessIn {
  tool: string;
  reading: string;
  sealed_at: string;
  guess: string;
  fit: 1 | 2 | 3 | 4 | 5 | null;
  fit_note: string | null;
  fit_at: string | null;
  /** How sure the person felt, 1 to 5 (exported as how_sure since migration 092). */
  confidence: 1 | 2 | 3 | 4 | 5 | null;
  /** What the logical mind said (exported as logical_mind_said since migration 096). */
  logic: string | null;
}

export function cleanGuessIn(raw: unknown): GuessIn | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Row;
  const sealed = isoDate(r.sealed_at);
  const guess = text(r.guess, 2000)?.trim();
  const tool = typeof r.tool === "string" ? r.tool : "";
  const reading = oneLine(r.reading, 1000);
  if (!sealed || !guess || !tool || !reading) return null;
  const fit = typeof r.fit === "number" && [1, 2, 3, 4, 5].includes(r.fit) ? (r.fit as GuessIn["fit"]) : null;
  return {
    tool, reading, sealed_at: sealed, guess, fit,
    fit_note: fit ? text(r.fit_note, 1000)?.trim() || null : null,
    fit_at: fit ? isoDate(r.fit_at) ?? sealed : null,
    confidence: typeof r.how_sure === "number" && [1, 2, 3, 4, 5].includes(r.how_sure) ? (r.how_sure as GuessIn["confidence"]) : null,
    logic: text(r.logical_mind_said, 2000)?.trim() || null,
  };
}

// ── Days ─────────────────────────────────────────────────────────────────────────────────────────────

export interface DayIn {
  day: string;
  writing: string;
  /** Only snapshots come in: a live link points into another copy of the app, where it would point at something else here. */
  snapshots: { kind: string; title: string | null; snapshot: string; created_at: string }[];
  links_left_out: number;
}

export function cleanDay(raw: unknown, now = Date.now()): DayIn | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Row;
  const day = typeof r.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.day) ? r.day : null;
  const t = day ? Date.parse(`${day}T12:00:00Z`) : NaN;
  if (!day || !Number.isFinite(t) || t < Date.UTC(1990, 0, 1) || t > now + 2 * 86_400_000) return null;
  const snapshots: DayIn["snapshots"] = [];
  let linksLeftOut = 0;
  for (const it of (Array.isArray(r.items) ? r.items : []).slice(0, 100)) {
    if (!it || typeof it !== "object") continue;
    const ir = it as Row;
    if (ir.mode !== "snapshot") { linksLeftOut++; continue; }
    const snap = text(ir.text, 20_000);
    if (typeof ir.kind !== "string" || !isItemKind(ir.kind) || snap === null) continue;
    snapshots.push({ kind: ir.kind, title: oneLine(ir.title, 300), snapshot: snap, created_at: isoDate(ir.added_at) ?? new Date().toISOString() });
  }
  const writing = text(r.writing, 20_000)?.trim() ?? "";
  return writing || snapshots.length || linksLeftOut ? { day, writing, snapshots, links_left_out: linksLeftOut } : null;
}

// ── Own archetypes, concepts, names, styles, cloths ──────────────────────────────────────────────────

export function cleanOwnArchetypeRow(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Row;
  const input = cleanArchetype({ name: r.name, realm: r.group, summary: r.summary, light: r.good_side, shadow: r.hard_side });
  return input.ok ? { ...input.value, created_at: isoDate(r.made_at) ?? new Date().toISOString(), updated_at: isoDate(r.changed_at) ?? new Date().toISOString() } : null;
}

export function cleanOwnConceptRow(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Row;
  const under = r.sits_under && typeof r.sits_under === "object" ? (r.sits_under as Row) : null;
  const input = cleanConcept({ name: r.name, description: r.description, realm: oneLine(r.realm, 80) ?? undefined });
  if (!input.ok) return null;
  return {
    ...input.value,
    under: under && typeof under.name === "string" && (under.kind === "shared archetype" || under.kind === "your archetype") ? { kind: under.kind as "shared archetype" | "your archetype", name: oneLine(under.name, 200) ?? "" } : null,
    created_at: isoDate(r.made_at) ?? new Date().toISOString(),
    updated_at: isoDate(r.changed_at) ?? new Date().toISOString(),
  };
}

export function cleanNameRow(raw: unknown): { piece_id: string; name: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Row;
  const name = cleanOwnName(r.name);
  return typeof r.piece_id === "string" && canNamePiece(r.piece_id) && name ? { piece_id: r.piece_id, name } : null;
}

export function cleanStyleRow(raw: unknown): { name: string; text: string; created_at: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Row;
  const name = cleanStyleName(r.name);
  const t = cleanStyleText(r.text);
  return name && t ? { name, text: t, created_at: isoDate(r.created_at) ?? new Date().toISOString() } : null;
}

export interface ClothIn {
  name: string;
  description: string | null;
  zones: Zone[];
}

export function cleanClothRow(raw: unknown): ClothIn | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Row;
  const zones = (Array.isArray(r.zones) ? r.zones : []).map((z) => {
    const zr = (z ?? {}) as Row;
    return { name: zr.name, note: zr.note, color: hexOrNull(zr.color), geom: zr.geometry };
  });
  const c = cleanCloth({ name: r.name, description: r.description, zones });
  return c.ok ? { name: c.name, description: c.description, zones: c.zones } : null;
}

export interface PlacementGroupIn {
  tool: string;
  made_at: string;
  cloth: string;
  rows: { item: string; where_kind: "zone" | "none" | "off"; zone: string | null; facing: "up" | "down" | null; simulated: boolean }[];
}

/** The placements of a file, grouped by the reading they were made for (the file names a reading by its tool and its moment, not by a number that would mean something else here). */
export function groupPlacements(raw: unknown): PlacementGroupIn[] {
  const groups = new Map<string, PlacementGroupIn>();
  for (const p of (Array.isArray(raw) ? raw : []).slice(0, IMPORT_LIMITS.rows * 4)) {
    if (!p || typeof p !== "object") continue;
    const r = p as Row;
    const reading = (r.reading && typeof r.reading === "object" ? r.reading : {}) as Row;
    const made = isoDate(reading.made_at);
    const cloth = oneLine(r.cloth, 60);
    const item = oneLine(r.item, 200);
    const where = typeof r.where === "string" ? r.where : "";
    if (!made || !cloth || !item || typeof reading.tool !== "string") continue;
    const zoneMatch = /^in (.+)$/.exec(where);
    const where_kind = zoneMatch ? "zone" : where === "on the cloth, in no zone" ? "none" : where === "off the cloth" ? "off" : null;
    if (!where_kind) continue;
    const key = `${reading.tool}|${made.slice(0, 19)}|${cloth}`;
    const g = groups.get(key) ?? groups.set(key, { tool: reading.tool, made_at: made, cloth, rows: [] }).get(key)!;
    g.rows.push({ item, where_kind, zone: zoneMatch ? oneLine(zoneMatch[1], 60) : null, facing: r.facing === "face up" ? "up" : r.facing === "face down" ? "down" : null, simulated: r.thrown_by_the_app === true });
  }
  return [...groups.values()];
}

export { cleanZone };

// ── Tarot practice ───────────────────────────────────────────────────────────────────────────────────

export interface PracticeIn {
  card: string;
  sensed_suit: "major" | "wands" | "cups" | "swords" | "pentacles";
  words: string | null;
  at: string;
}

const PRACTICE_CARD = /^(major-(\d|1\d|2[01])|(wands|cups|swords|pentacles)-(ace|[2-9]|10|page|knight|queen|king))$/;
const PRACTICE_SUITS_IN = ["major", "wands", "cups", "swords", "pentacles"];

export interface DailyTrialIn {
  target_index: number;
  choice_index: number;
  seal: string;
  secret: string;
  started_at: string;
  chosen_at: string;
}

/** A judged daily five-shape trial of blind-target practice, as the export writes it. The shapes are named, the seal and the secret number kept as they were. */
export function cleanDailyTrialRow(raw: unknown): DailyTrialIn | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Row;
  const started = isoDate(r.started_at);
  const chosen = isoDate(r.chosen_at) ?? started;
  const target = typeof r.target === "string" ? (DAILY_SHAPES as readonly string[]).indexOf(r.target) : -1;
  const choice = typeof r.your_choice === "string" ? (DAILY_SHAPES as readonly string[]).indexOf(r.your_choice) : -1;
  if (!started || !chosen || target < 0 || choice < 0) return null;
  if (typeof r.seal !== "string" || !/^[0-9a-f]{64}$/.test(r.seal)) return null;
  if (typeof r.secret_number !== "string" || !/^[0-9a-zA-Z_-]{1,128}$/.test(r.secret_number)) return null;
  return { target_index: target, choice_index: choice, seal: r.seal, secret: r.secret_number, started_at: started, chosen_at: chosen };
}

export function cleanPracticeRow(raw: unknown): PracticeIn | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Row;
  const at = isoDate(r.at);
  if (!at || typeof r.card !== "string" || !PRACTICE_CARD.test(r.card)) return null;
  if (typeof r.sensed_suit !== "string" || !PRACTICE_SUITS_IN.includes(r.sensed_suit)) return null;
  return { card: r.card, sensed_suit: r.sensed_suit as PracticeIn["sensed_suit"], words: text(r.words, 1000)?.trim() || null, at };
}
