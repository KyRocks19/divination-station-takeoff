import { query, queryOne } from "./db";
import { ownLinksFor } from "./companion-own";
import { sensedFirstFor } from "./companion-guess";
import { faceWords, placeWords } from "./charms-core";
import {
  MAX_CONTEXT_CHARS,
  day,
  formatContext,
  replacedWordings,
  toKind,
  type CompanionContext,
  type ContextEarlierMeaning,
  type ContextEarlierPull,
  type ContextEntry,
  type ContextItem,
} from "./companion-context";

// The same text lib/companion-context.ts builds for the oracle deck, for the person's readings with the other tools: runes, ogham, dice and
// coins, the pendulum, scrying, tarot, the I Ching, geomancy, bibliomancy, playing cards, charms, signs and dreams, tea leaves, and ink blots. Only the person's own rows are read (the symbol that came up, the words they wrote for it, what they
// wrote about the reading); the stock rune poems, ogham texts, die meanings, and common meanings are never read. Like its sibling this file must
// not import any data file (tests/companion-context.test.ts checks it), which is why it asks the database itself instead of using lib/runes.ts,
// lib/ogham.ts, lib/dice.ts, and lib/pendulum.ts.

// Blind-target practice is deliberately not here: its options and target are sealed until the person chooses (migration 085), and the trial is
// practice in unaided perception (docs/tool-parity.md).
export type ToolKind = "runes" | "ogham" | "dice" | "pendulum" | "scrying" | "tarot" | "iching" | "geomancy" | "bibliomancy" | "playingcards" | "charms" | "signs" | "tea" | "blots";
export const TOOL_KINDS: ToolKind[] = ["runes", "ogham", "dice", "pendulum", "scrying", "tarot", "iching", "geomancy", "bibliomancy", "playingcards", "charms", "signs", "tea", "blots"];
export const isToolKind = (k: unknown): k is ToolKind => TOOL_KINDS.includes(k as ToolKind);

/** The kind of a reading, when it is the person's. */
export async function divinationKind(userId: number, id: number): Promise<string | null> {
  const row = await queryOne<{ kind: string }>("SELECT kind FROM divinations WHERE id = $1 AND user_id = $2", [id, userId]);
  return row?.kind ?? null;
}

interface Head {
  id: number;
  question: string | null;
  created_at: string;
  layout_name: string | null;
}

interface Symbol {
  /** The key the person's own words for it are kept under (card_customizations.card_id), if the tool has one. */
  key: string | null;
  name: string;
  reversed: boolean;
  position: string | null;
  positionPrompt: string | null;
  /** Wording the person had for it at the time (the pendulum keeps this on the answer), instead of the current one. */
  meaningThen?: string | null;
  /** How to find the person's earlier readings that had the same thing come up. */
  earlierSql: { text: string; params: unknown[] } | null;
  /** The swing, for the pendulum's wording history. */
  swingId?: number | null;
  /** The id the person's own links are kept under ("rune-fehu", "swing-line-45", "scrying-ball"), when it is not `key`. */
  ownKey?: string | null;
}

export async function entriesFor(userId: number, ids: number[]): Promise<Map<number, ContextEntry[]>> {
  const map = new Map<number, ContextEntry[]>();
  if (ids.length === 0) return map;
  const rows = await query<{ divination_id: number; kind: string; thinking_mind: number; content: string; created_at: string }>(
    `SELECT d.id AS divination_id, j.kind, j.thinking_mind, j.content, j.created_at
     FROM journals j JOIN divinations d ON (d.id = j.divination_id OR (j.reading_id IS NOT NULL AND d.reading_id = j.reading_id))
     WHERE d.id = ANY($1) AND d.user_id = $2 AND j.author = 'user'
     ORDER BY j.created_at, j.id`,
    [ids, userId]
  );
  for (const r of rows) {
    const list = map.get(r.divination_id) ?? [];
    list.push({ when: day(r.created_at), kind: toKind(r.kind), thinkingMind: r.thinking_mind === 1, content: r.content });
    map.set(r.divination_id, list);
  }
  return map;
}

const wording = (keywords: string | null, description: string | null) => [keywords, description].map((s) => s?.trim()).filter(Boolean).join(" — ");

interface OwnMeaning {
  /** The day the current wording was written. */
  updatedAt: string | null;
  upright: string;
  reversed: string;
  earlierUpright: { when: string; content: string }[];
  earlierReversed: { when: string; content: string }[];
}

/** The person's own words for runes, staves, and die faces (kept in card_customizations), with the wordings they replaced. */
async function ownMeanings(userId: number, keys: string[]): Promise<Map<string, OwnMeaning>> {
  const map = new Map<string, OwnMeaning>();
  const ids = [...new Set(keys)];
  if (ids.length === 0) return map;
  const [current, revisions] = await Promise.all([
    query<{ card_id: string; upright_keywords: string | null; reversed_keywords: string | null; upright_description: string | null; reversed_description: string | null; updated_at: string }>(
      "SELECT card_id, upright_keywords, reversed_keywords, upright_description, reversed_description, updated_at FROM card_customizations WHERE user_id = $1 AND card_id = ANY($2)",
      [userId, ids]
    ),
    query<{ card_id: string; upright_keywords: string | null; reversed_keywords: string | null; upright_description: string | null; reversed_description: string | null; created_at: string }>(
      "SELECT card_id, upright_keywords, reversed_keywords, upright_description, reversed_description, created_at FROM card_meaning_revisions WHERE user_id = $1 AND card_id = ANY($2) ORDER BY created_at DESC, id DESC",
      [userId, ids]
    ),
  ]);
  for (const id of ids) {
    const c = current.find((r) => r.card_id === id);
    const upright = c ? wording(c.upright_keywords, c.upright_description) : "";
    const reversed = c ? wording(c.reversed_keywords, c.reversed_description) : "";
    const revs = revisions.filter((r) => r.card_id === id);
    map.set(id, {
      updatedAt: c ? day(c.updated_at) : null,
      upright,
      reversed,
      earlierUpright: replacedWordings(upright, revs.map((r) => ({ when: day(r.created_at), content: wording(r.upright_keywords, r.upright_description) }))),
      earlierReversed: replacedWordings(reversed, revs.map((r) => ({ when: day(r.created_at), content: wording(r.reversed_keywords, r.reversed_description) }))),
    });
  }
  return map;
}

async function earlierReadings(userId: number, sym: Symbol, thisId: number): Promise<ContextEarlierPull[]> {
  if (!sym.earlierSql) return [];
  const rows = await query<{ id: number; question: string | null; created_at: string; reversed: number | null }>(sym.earlierSql.text, [userId, ...sym.earlierSql.params, thisId]);
  const entries = await entriesFor(userId, rows.map((r) => r.id));
  return rows.map((r) => ({ when: day(r.created_at), question: r.question, reversed: r.reversed === 1, entries: entries.get(r.id) ?? [] }));
}

const EARLIER_LIMIT = 3;
const SURFACE: Record<string, string> = { mirror: "dark mirror", ball: "crystal ball", water: "bowl of water" };

/** Where a figure sat in a geomancy chart, in plain words (these are positions, not meanings). */
const GEOMANCY_PLACES: Record<string, string> = {
  mother1: "First Mother", mother2: "Second Mother", mother3: "Third Mother", mother4: "Fourth Mother",
  rightWitness: "Right Witness", leftWitness: "Left Witness", judge: "Judge",
};

/** A coin side or die face as a name: "d6 showing 3", "coin: heads". */
export function faceName(object: string, face: string): string {
  return object === "coin" ? `coin: ${face}` : `${object} showing ${face}`;
}

/**
 * Reads a person's reading with one of the other tools and what they wrote about it, then formats it. Null when it is not theirs or is not
 * of that kind. With `history` the person's earlier wordings of each meaning are included too (for "what has changed").
 */
export async function buildToolContext(userId: number, divinationId: number, kind: ToolKind, opts: { history?: boolean } = {}): Promise<CompanionContext | null> {
  const head = await queryOne<Head>("SELECT id, question, created_at, layout_name FROM divinations WHERE id = $1 AND user_id = $2 AND kind = $3", [divinationId, userId, kind]);
  if (!head) return null;

  let noun = "symbol";
  let extra: string[] = [];
  let symbols: Symbol[] = [];
  let tarotNotes: ContextEntry | null = null;

  if (kind === "runes") {
    noun = "rune";
    const rows = await query<{ rune_id: string; rune_name: string; reversed: number; position_name: string | null; position_prompt: string | null }>(
      `SELECT r.rune_id, r.rune_name, r.reversed, r.position_name,
              (SELECT lp.prompt FROM layout_positions lp WHERE lp.layout_id = dv.layout_id AND lp.name = r.position_name LIMIT 1) AS position_prompt
       FROM rune_draws r JOIN divinations dv ON dv.id = r.divination_id
       WHERE r.user_id = $1 AND r.divination_id = $2 ORDER BY r.sort_order, r.id`,
      [userId, divinationId]
    );
    symbols = rows.map((r) => ({
      key: r.rune_id,
      name: r.rune_name,
      reversed: r.reversed === 1,
      position: r.position_name,
      positionPrompt: r.position_prompt,
      earlierSql: {
        text: `SELECT DISTINCT ON (d.id) d.id, d.question, d.created_at, r.reversed FROM rune_draws r JOIN divinations d ON d.id = r.divination_id
               WHERE r.user_id = $1 AND r.rune_id = $2 AND d.id <> $3 ORDER BY d.id DESC LIMIT ${EARLIER_LIMIT}`,
        params: [r.rune_id],
      },
    }));
  } else if (kind === "ogham") {
    noun = "stave";
    const rows = await query<{ stave_id: string; stave_name: string; position_name: string | null; position_prompt: string | null }>(
      `SELECT o.stave_id, o.stave_name, o.position_name,
              (SELECT lp.prompt FROM layout_positions lp WHERE lp.layout_id = dv.layout_id AND lp.name = o.position_name LIMIT 1) AS position_prompt
       FROM ogham_draws o JOIN divinations dv ON dv.id = o.divination_id
       WHERE o.user_id = $1 AND o.divination_id = $2 ORDER BY o.sort_order, o.id`,
      [userId, divinationId]
    );
    symbols = rows.map((r) => ({
      key: r.stave_id,
      name: r.stave_name,
      reversed: false,
      position: r.position_name,
      positionPrompt: r.position_prompt,
      earlierSql: {
        text: `SELECT DISTINCT ON (d.id) d.id, d.question, d.created_at, 0 AS reversed FROM ogham_draws o JOIN divinations d ON d.id = o.divination_id
               WHERE o.user_id = $1 AND o.stave_id = $2 AND d.id <> $3 ORDER BY d.id DESC LIMIT ${EARLIER_LIMIT}`,
        params: [r.stave_id],
      },
    }));
  } else if (kind === "dice") {
    const rows = await query<{ object: string; face: string; position_name: string | null; position_prompt: string | null }>(
      `SELECT t.object, t.face, t.position_name,
              (SELECT lp.prompt FROM layout_positions lp WHERE lp.layout_id = dv.layout_id AND lp.name = t.position_name LIMIT 1) AS position_prompt
       FROM dice_throws t JOIN divinations dv ON dv.id = t.divination_id
       WHERE t.user_id = $1 AND t.divination_id = $2 ORDER BY t.sort_order, t.id`,
      [userId, divinationId]
    );
    // A throw can mix kinds of object, so the noun follows what was thrown.
    const kinds = new Set(rows.map((r) => (r.object === "coin" ? "coin" : "die")));
    noun = kinds.size > 1 ? "die face or coin side" : kinds.has("coin") ? "coin side" : "die face";
    symbols = rows.map((r) => ({
      // The key the person's own words for a face are kept under: "coin-heads" or "die-d6-3".
      key: r.object === "coin" ? `coin-${r.face}` : `die-${r.object}-${r.face}`,
      name: faceName(r.object, r.face),
      reversed: false,
      position: r.position_name,
      positionPrompt: r.position_prompt,
      earlierSql: {
        text: `SELECT DISTINCT ON (d.id) d.id, d.question, d.created_at, 0 AS reversed FROM dice_throws t JOIN divinations d ON d.id = t.divination_id
               WHERE t.user_id = $1 AND t.object = $2 AND t.face = $3 AND d.id <> $4 ORDER BY d.id DESC LIMIT ${EARLIER_LIMIT}`,
        params: [r.object, r.face],
      },
    }));
  } else if (kind === "pendulum") {
    noun = "swing";
    const a = await queryOne<{ swing_id: number | null; swing_name: string; meaning: string | null; shape: string; angle: number | null }>(
      "SELECT swing_id, swing_name, meaning, shape, angle FROM pendulum_answers WHERE divination_id = $1 AND user_id = $2",
      [divinationId, userId]
    );
    if (a) {
      symbols = [
        {
          key: null,
          name: a.swing_name,
          reversed: false,
          position: null,
          positionPrompt: null,
          meaningThen: a.meaning,
          swingId: a.swing_id,
          ownKey: a.shape === "line" && a.angle !== null ? `swing-line-${a.angle}` : `swing-${a.shape}`,
          earlierSql: a.swing_id
            ? {
                text: `SELECT d.id, d.question, d.created_at, 0 AS reversed FROM pendulum_answers p JOIN divinations d ON d.id = p.divination_id
                       WHERE p.user_id = $1 AND p.swing_id = $2 AND d.id <> $3 ORDER BY d.id DESC LIMIT ${EARLIER_LIMIT}`,
                params: [a.swing_id],
              }
            : null,
        },
      ];
    }
  } else if (kind === "tarot") {
    // The person's own meanings for a card are the only meaning sent; the Pixie-Smith deck and its stock text are never read here.
    noun = "card";
    const reading = await queryOne<{ id: number; cards: string; clarifiers: string | null; notes: string | null }>(
      "SELECT r.id, r.cards, r.clarifiers, r.notes FROM readings r JOIN divinations d ON d.reading_id = r.id WHERE d.id = $1 AND r.user_id = $2",
      [divinationId, userId]
    );
    if (reading) {
      type Drawn = { position?: string; card_id: string; card_name: string; reversed?: boolean };
      const parse = <T,>(s: string | null, fallback: T): T => {
        try {
          return s ? (JSON.parse(s) as T) : fallback;
        } catch {
          return fallback;
        }
      };
      const earlier = (cardId: string) => ({
        text: `SELECT DISTINCT ON (d.id) d.id, d.question, d.created_at, cd.reversed FROM card_draws cd JOIN divinations d ON d.reading_id = cd.reading_id
               WHERE cd.user_id = $1 AND cd.card_id = $2 AND cd.is_clarifier = 0 AND d.id <> $3 ORDER BY d.id DESC LIMIT ${EARLIER_LIMIT}`,
        params: [cardId],
      });
      const cards = parse<Drawn[]>(reading.cards, []);
      const clarifiers = parse<Record<string, Drawn[]>>(reading.clarifiers, {});
      for (const [i, c] of cards.entries()) {
        symbols.push({ key: c.card_id, name: c.card_name, reversed: !!c.reversed, position: c.position ?? null, positionPrompt: null, earlierSql: earlier(c.card_id) });
        for (const cl of clarifiers[String(i)] ?? []) {
          symbols.push({ key: cl.card_id, name: cl.card_name, reversed: !!cl.reversed, position: `clarifier for ${c.card_name}`, positionPrompt: null, earlierSql: null });
        }
      }
      // The notes the person wrote on the reading itself.
      if (reading.notes?.trim()) tarotNotes = { when: day(head.created_at), kind: "note", thinkingMind: false, content: reading.notes.trim() };
    }
  } else if (kind === "iching") {
    noun = "hexagram";
    const c = await queryOne<{ lines: string; primary_number: number; primary_name: string; relating_number: number | null; relating_name: string | null }>(
      "SELECT lines, primary_number, primary_name, relating_number, relating_name FROM iching_casts WHERE divination_id = $1 AND user_id = $2",
      [divinationId, userId]
    );
    if (c) {
      const earlier = (n: number) => ({
        text: `SELECT DISTINCT ON (d.id) d.id, d.question, d.created_at, 0 AS reversed FROM iching_casts c JOIN divinations d ON d.id = c.divination_id
               WHERE c.user_id = $1 AND (c.primary_number = $2 OR c.relating_number = $2) AND d.id <> $3 ORDER BY d.id DESC LIMIT ${EARLIER_LIMIT}`,
        params: [n],
      });
      const changing = c.lines.split("").flatMap((v, i) => (v === "6" || v === "9" ? [i + 1] : []));
      extra = [`The lines of your cast, from the bottom (6 old yin, 7 young yang, 8 young yin, 9 old yang): ${c.lines.split("").join(", ")}.`, changing.length ? `The changing lines: ${changing.join(", ")}.` : "No line was changing."];
      symbols.push({ key: `hexagram-${c.primary_number}`, name: c.primary_name, reversed: false, position: "the cast", positionPrompt: null, earlierSql: earlier(c.primary_number) });
      if (c.relating_number !== null && c.relating_name) {
        symbols.push({ key: `hexagram-${c.relating_number}`, name: c.relating_name, reversed: false, position: "what the changing lines turn it into", positionPrompt: null, earlierSql: earlier(c.relating_number) });
      }
    }
  } else if (kind === "geomancy") {
    noun = "figure";
    const rows = await query<{ place: string; figure_id: string; figure_name: string }>(
      "SELECT place, figure_id, figure_name FROM geomancy_figures WHERE divination_id = $1 AND user_id = $2 ORDER BY sort_order, id",
      [divinationId, userId]
    );
    // The four Mothers are the cast, the Witnesses and the Judge the answer; the figures made in between are in the chart but not set out here.
    for (const r of rows) {
      const where = GEOMANCY_PLACES[r.place];
      if (!where) continue;
      symbols.push({
        key: r.figure_id,
        name: r.figure_name,
        reversed: false,
        position: where,
        positionPrompt: null,
        earlierSql: {
          text: `SELECT DISTINCT ON (d.id) d.id, d.question, d.created_at, 0 AS reversed FROM geomancy_figures f JOIN divinations d ON d.id = f.divination_id
                 WHERE f.user_id = $1 AND f.figure_id = $2 AND (f.place LIKE 'mother%' OR f.place = 'judge') AND d.id <> $3 ORDER BY d.id DESC LIMIT ${EARLIER_LIMIT}`,
          params: [r.figure_id],
        },
      });
    }
  } else if (kind === "bibliomancy") {
    noun = "passage";
    const rows = await query<{ unit: string; passage: string; context: string | null; source_label: string; source_when: string | null }>(
      "SELECT unit, passage, context, source_label, source_when FROM bibliomancy_pulls WHERE divination_id = $1 AND user_id = $2 ORDER BY sort_order, id",
      [divinationId, userId]
    );
    // The passages are the person's own words, pulled from their own writing; the sentence around each is theirs too.
    for (const r of rows) {
      extra.push(`You pulled this ${r.unit} from your own writing (${r.source_label}${r.source_when ? `, ${day(r.source_when)}` : ""}): ${r.passage}`);
      if (r.context && r.context !== r.passage) extra.push(`The sentence around it: ${r.context}`);
      if (r.unit === "word") {
        symbols.push({
          key: null,
          name: r.passage,
          reversed: false,
          position: null,
          positionPrompt: null,
          earlierSql: {
            text: `SELECT DISTINCT ON (d.id) d.id, d.question, d.created_at, 0 AS reversed FROM bibliomancy_pulls p JOIN divinations d ON d.id = p.divination_id
                   WHERE p.user_id = $1 AND p.unit = 'word' AND lower(p.passage) = lower($2) AND d.id <> $3 ORDER BY d.id DESC LIMIT ${EARLIER_LIMIT}`,
            params: [r.passage],
          },
        });
      }
    }
  } else if (kind === "playingcards") {
    noun = "playing card";
    const rows = await query<{ card_id: string; card_name: string }>(
      "SELECT card_id, card_name FROM playing_card_draws WHERE divination_id = $1 AND user_id = $2 ORDER BY sort_order, id",
      [divinationId, userId]
    );
    // The app gives no meaning for a playing card; the person's own words for one are kept under 'playing-<card id>'.
    symbols = rows.map((r) => ({
      key: `playing-${r.card_id}`,
      name: r.card_name,
      reversed: false,
      position: null,
      positionPrompt: null,
      earlierSql: {
        text: `SELECT DISTINCT ON (d.id) d.id, d.question, d.created_at, 0 AS reversed FROM playing_card_draws p JOIN divinations d ON d.id = p.divination_id
               WHERE p.user_id = $1 AND p.card_id = $2 AND d.id <> $3 ORDER BY d.id DESC LIMIT ${EARLIER_LIMIT}`,
        params: [r.card_id],
      },
    }));
  } else if (kind === "charms") {
    noun = "charm";
    const rows = await query<{ set_name: string; card_id: number | null; charm_name: string; x: number; y: number; face: "up" | "down" }>(
      "SELECT set_name, card_id, charm_name, x, y, face FROM charm_casts WHERE divination_id = $1 AND user_id = $2 ORDER BY sort_order, id",
      [divinationId, userId]
    );
    // The charms and their set are the person's own (an oracle set of the form "charms"); where each landed is put in words, with no meaning given.
    if (rows.length) extra = [`You cast your set "${rows[0].set_name}" onto a square cloth.`];
    symbols = rows.map((r) => ({
      key: null,
      name: r.charm_name,
      reversed: false,
      position: `${faceWords(r.face)}, ${placeWords(r.x, r.y)}`,
      positionPrompt: null,
      earlierSql:
        r.card_id === null
          ? null
          : {
              text: `SELECT DISTINCT ON (d.id) d.id, d.question, d.created_at, 0 AS reversed FROM charm_casts c JOIN divinations d ON d.id = c.divination_id
                     WHERE c.user_id = $1 AND c.card_id = $2 AND d.id <> $3 ORDER BY d.id DESC LIMIT ${EARLIER_LIMIT}`,
              params: [r.card_id],
            },
    }));
  } else if (kind === "signs") {
    noun = "signs and dreams";
    const s = await queryOne<{ note_type: "sign" | "dream"; body: string; happened_on: string | null }>(
      "SELECT note_type, body, happened_on FROM sign_notes WHERE divination_id = $1 AND user_id = $2",
      [divinationId, userId]
    );
    // The note is the person's own writing; there is nothing else in it.
    if (s) extra = [`${s.note_type === "dream" ? "A dream you wrote down" : "A sign you noticed"}${s.happened_on ? ` (it happened on ${day(s.happened_on)})` : ""}: ${s.body}`];
  } else if (kind === "tea" || kind === "blots") {
    const b = await queryOne<{ vessel: "cup" | "ink" }>("SELECT vessel FROM blot_casts WHERE divination_id = $1 AND user_id = $2", [divinationId, userId]);
    noun = b?.vessel === "cup" ? "tea leaves" : "ink blot";
    // The shape is drawn at random and has no meaning given; what the person saw in it is in their entries below.
    if (b) extra = [b.vessel === "cup" ? "A tea-leaf shape in a cup, drawn at random. What you saw in it is in your words below." : "An ink blot, drawn at random. What you saw in it is in your words below."];
  } else {
    noun = "surface";
    const s = await queryOne<{ surface: string; minutes: number | null }>("SELECT surface, minutes FROM scrying_sessions WHERE divination_id = $1 AND user_id = $2", [divinationId, userId]);
    if (s) {
      const label = SURFACE[s.surface] ?? s.surface;
      extra = [`You looked into: a ${label}${s.minutes ? `, for ${s.minutes} minute${s.minutes === 1 ? "" : "s"}` : ""}.`];
      symbols = [
        {
          key: null,
          ownKey: `scrying-${s.surface}`,
          name: label,
          reversed: false,
          position: null,
          positionPrompt: null,
          earlierSql: {
            text: `SELECT d.id, d.question, d.created_at, 0 AS reversed FROM scrying_sessions s JOIN divinations d ON d.id = s.divination_id
                   WHERE s.user_id = $1 AND s.surface = $2 AND d.id <> $3 ORDER BY d.id DESC LIMIT ${EARLIER_LIMIT}`,
            params: [s.surface],
          },
        },
      ];
    }
  }

  const keys = symbols.map((s) => s.key).filter((k): k is string => !!k);
  const ownKeys = symbols.map((s) => s.ownKey ?? s.key).filter((k): k is string => !!k);
  const [own, entries, ownLinks] = await Promise.all([ownMeanings(userId, keys), entriesFor(userId, [divinationId]), ownLinksFor(userId, ownKeys, [])]);

  const items: ContextItem[] = [];
  for (const sym of symbols) {
    const mine = sym.key ? own.get(sym.key) : undefined;
    const meanings: ContextItem["meanings"] = [];
    let earlierMeanings: ContextEarlierMeaning[] = [];
    if (sym.key && mine) {
      if (mine.upright) meanings.push({ label: null, content: mine.upright, upsideDown: false, when: mine.updatedAt ?? undefined });
      if (mine.reversed) meanings.push({ label: null, content: mine.reversed, upsideDown: true, when: mine.updatedAt ?? undefined });
      earlierMeanings = [
        ...mine.earlierUpright.map((v) => ({ when: v.when, label: null, content: v.content, upsideDown: false })),
        ...mine.earlierReversed.map((v) => ({ when: v.when, label: null, content: v.content, upsideDown: true })),
      ];
    } else if (kind === "pendulum") {
      // The wording the swing had when the answer came, then the wordings it has had since.
      if (sym.meaningThen?.trim()) meanings.push({ label: null, content: sym.meaningThen.trim(), upsideDown: false, when: day(head.created_at) });
      if (sym.swingId) {
        const [swing, revs] = await Promise.all([
          queryOne<{ meaning: string | null; updated_at: string }>("SELECT meaning, updated_at FROM pendulum_swings WHERE id = $1 AND user_id = $2", [sym.swingId, userId]),
          query<{ content: string; created_at: string }>("SELECT content, created_at FROM pendulum_swing_revisions WHERE swing_id = $1 AND user_id = $2 ORDER BY created_at DESC, id DESC", [sym.swingId, userId]),
        ]);
        const versions = [...(swing?.meaning ? [{ content: swing.meaning, when: day(swing.updated_at) }] : []), ...revs.map((r) => ({ content: r.content, when: day(r.created_at) }))];
        earlierMeanings = replacedWordings(sym.meaningThen ?? null, versions).map((v) => ({ when: v.when, label: null, content: v.content, upsideDown: false }));
      }
    }
    items.push({
      name: sym.name,
      reversed: sym.reversed,
      position: sym.position,
      positionPrompt: sym.positionPrompt,
      origin: null,
      fields: [],
      meanings,
      earlierMeanings,
      earlier: await earlierReadings(userId, sym, divinationId),
      ownLinks: ownLinks.bySymbol.get(sym.ownKey ?? sym.key ?? "") ?? [],
    });
  }

  return formatContext(
    {
      noun, when: day(head.created_at), question: head.question, layoutName: head.layout_name, extra, items,
      entries: [...(tarotNotes ? [tarotNotes] : []), ...(entries.get(divinationId) ?? [])],
      sensedFirst: await sensedFirstFor(userId, divinationId),
    },
    MAX_CONTEXT_CHARS,
    opts
  );
}
