import { query, queryOne } from "./db";
import { artFileExists, readArt } from "./art-store";
import type { SetForm } from "./oracle-forms";

// The oracle deck kit: decks and cards a person makes themselves (migration 017).
// Nothing in these tables is written by the app. Every word is the person's own.

export interface OracleDeck {
  id: number;
  name: string;
  description: string | null;
  /** 0/1. When 1, a pulled card can land upside down. */
  reversals: number;
  /** Out of 100 pulls, about how many land upside down when reversals are on. The person sets it. */
  reversal_chance: number;
  /** What the set is made of: cards, stones, staves, or charms (migration 035). Changes wording and shape only. */
  form: SetForm;
  card_count: number;
  created_at: string;
  updated_at: string;
}

export interface OracleCardSummary {
  id: number;
  deck_id: number;
  name: string;
  origin: string | null;
  /** 0/1. A resting card stays in the deck but is not pulled until the person wakes it. */
  resting: number;
  meaning_count: number;
  /** Changes whenever the item's picture does; null when it has none. Used to fetch the new picture. */
  art_version: string | null;
  /** The person's description of the picture, for screen readers. */
  art_alt: string | null;
  created_at: string;
  updated_at: string;
}

/** A version of a meaning that the person has since changed. created_at is when that version was written. */
export interface OracleMeaningVersion {
  id: number;
  label: string | null;
  content: string;
  created_at: string;
}

export interface OracleMeaning {
  id: number;
  /** Optional free text, for example who wrote this meaning. */
  label: string | null;
  content: string;
  /** 0/1. 1 marks a meaning for when the card lands upside down. */
  reversed: number;
  created_at: string;
  /** When the current text was written. */
  updated_at: string;
  /** Versions that came before the current text, newest first. */
  earlier: OracleMeaningVersion[];
}

/** A field the person named themselves, for example "song". */
export interface OracleField {
  id: number;
  name: string;
  value: string | null;
}

/** A field name the person has used, and on how many of their cards. */
export interface OracleFieldName {
  name: string;
  cards: number;
}

/** The picture of an item, as the editor needs it. */
export interface OracleArt {
  kind: "drawing" | "upload";
  alt: string | null;
  /** How the picture was made ('local-image-tool'), or null; the person can remove the note. */
  made_with: string | null;
  /** True when the picture is a file on the owner's computer and that file cannot be reached from here. */
  offline: boolean;
  version: string;
  /** The strokes of a drawing, as saved; null for an upload. */
  drawing: { background: string; strokes: { c: string; w: number; p: [number, number][] }[] } | null;
}

export interface OracleCard {
  id: number;
  deck_id: number;
  deck_name: string;
  /** 0/1. Whether the card's deck has reversals on. */
  deck_reversals: number;
  /** The form of the card's set. */
  deck_form: SetForm;
  name: string;
  /** Where the card comes from, in the person's words. */
  origin: string | null;
  /** 0/1. A resting card stays in the deck but is not pulled until the person wakes it. */
  resting: number;
  created_at: string;
  updated_at: string;
  meanings: OracleMeaning[];
  fields: OracleField[];
  art: OracleArt | null;
}

/** The name given to the deck that is made automatically with a person's first card. They can rename it. */
export const FIRST_DECK_NAME = "Oracle deck";

/** Route ids arrive as text. Anything that is not a positive whole number becomes 0, which matches no row. */
export function toId(raw: unknown): number {
  const n = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() ? Number(raw) : NaN;
  return Number.isInteger(n) && n > 0 && n <= 2147483647 ? n : 0;
}

/** Trimmed text, or null when the value is blank or is not text. */
export function cleanText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function listDecks(userId: number): Promise<OracleDeck[]> {
  return query<OracleDeck>(
    `SELECT d.id, d.name, d.description, d.reversals, d.reversal_chance, d.form, d.created_at, d.updated_at,
            (SELECT COUNT(*)::int FROM oracle_cards c WHERE c.deck_id = d.id) AS card_count
     FROM oracle_decks d
     WHERE d.user_id = $1
     ORDER BY d.created_at ASC, d.id ASC`,
    [userId]
  );
}

/** The cards in a deck, in the person's own order. Cards they have never moved stay in the order they were made. */
export async function listCards(userId: number, deckId: number): Promise<OracleCardSummary[]> {
  return query<OracleCardSummary>(
    `SELECT c.id, c.deck_id, c.name, c.origin, c.resting, c.created_at, c.updated_at,
            (SELECT COUNT(*)::int FROM oracle_card_meanings m WHERE m.card_id = c.id) AS meaning_count,
            (SELECT TO_CHAR(a.updated_at, 'YYYYMMDDHH24MISSUS') FROM oracle_card_art a WHERE a.card_id = c.id) AS art_version,
            (SELECT a.alt FROM oracle_card_art a WHERE a.card_id = c.id) AS art_alt
     FROM oracle_cards c
     WHERE c.user_id = $1 AND c.deck_id = $2
     ORDER BY c.sort_order ASC, c.created_at ASC, c.id ASC`,
    [userId, deckId]
  );
}

/** One card with everything the person has written on it, or null when it is not theirs. */
/** The picture of an item as the editor needs it. A drawing kept as a file is read from disk; a file that cannot be reached marks the picture offline. */
async function artOf(
  row: { kind: "drawing" | "upload"; alt: string | null; made_with: string | null; strokes: string | null; file_key: string | null; version: string },
  userId: number
): Promise<OracleArt> {
  let strokes = row.strokes;
  let offline = false;
  if (row.file_key) {
    if (row.kind === "drawing") {
      strokes = (await readArt(row.file_key, userId))?.toString("utf8") ?? null;
      offline = strokes === null;
    } else {
      offline = !(await artFileExists(row.file_key, userId));
    }
  }
  return {
    kind: row.kind,
    alt: row.alt,
    made_with: row.made_with,
    offline,
    version: row.version,
    drawing: strokes ? JSON.parse(strokes) : null,
  };
}

export async function loadCard(userId: number, cardId: number): Promise<OracleCard | null> {
  const card = await queryOne<Omit<OracleCard, "meanings" | "fields" | "art">>(
    `SELECT c.id, c.deck_id, d.name AS deck_name, d.reversals AS deck_reversals, d.form AS deck_form, c.name, c.origin, c.resting,
            c.created_at, c.updated_at
     FROM oracle_cards c JOIN oracle_decks d ON d.id = c.deck_id
     WHERE c.id = $1 AND c.user_id = $2`,
    [cardId, userId]
  );
  if (!card) return null;

  const [meanings, versions, fields, artRow] = await Promise.all([
    query<Omit<OracleMeaning, "earlier">>(
      `SELECT id, label, content, reversed, created_at, updated_at
       FROM oracle_card_meanings
       WHERE card_id = $1 AND user_id = $2
       ORDER BY sort_order ASC, created_at ASC, id ASC`,
      [cardId, userId]
    ),
    query<OracleMeaningVersion & { meaning_id: number }>(
      `SELECT r.id, r.meaning_id, r.label, r.content, r.created_at
       FROM oracle_card_meaning_revisions r
       JOIN oracle_card_meanings m ON m.id = r.meaning_id
       WHERE m.card_id = $1 AND r.user_id = $2
       ORDER BY r.created_at DESC, r.id DESC`,
      [cardId, userId]
    ),
    query<OracleField>(
      `SELECT id, name, value
       FROM oracle_card_fields
       WHERE card_id = $1 AND user_id = $2
       ORDER BY sort_order ASC, id ASC`,
      [cardId, userId]
    ),
    queryOne<{ kind: "drawing" | "upload"; alt: string | null; made_with: string | null; strokes: string | null; file_key: string | null; version: string }>(
      `SELECT a.kind, a.alt, a.made_with, a.strokes, a.file_key, TO_CHAR(a.updated_at, 'YYYYMMDDHH24MISSUS') AS version
       FROM oracle_card_art a WHERE a.card_id = $1 AND a.user_id = $2`,
      [cardId, userId]
    ),
  ]);

  return {
    ...card,
    meanings: meanings.map((m) => ({
      ...m,
      earlier: versions
        .filter((v) => v.meaning_id === m.id)
        .map(({ id, label, content, created_at }) => ({ id, label, content, created_at })),
    })),
    fields,
    art: artRow ? await artOf(artRow, userId) : null,
  };
}

/**
 * The field names the person has used on any of their cards, most used first, so a name typed once can be used
 * again. Names that differ only in capital letters or spaces around them count as one, shown as last written.
 */
export function listFieldNames(userId: number): Promise<OracleFieldName[]> {
  return query<OracleFieldName>(
    `SELECT (ARRAY_AGG(name ORDER BY updated_at DESC, id DESC))[1] AS name,
            COUNT(DISTINCT card_id)::int AS cards
     FROM oracle_card_fields
     WHERE user_id = $1
     GROUP BY LOWER(BTRIM(name))
     ORDER BY cards DESC, LOWER(BTRIM(name)) ASC`,
    [userId]
  );
}

/** A card that came up in a pull. Its name is kept as it was, even if the card is deleted later. */
export interface OraclePullCard {
  id: number;
  /** null when the card has since been deleted. */
  card_id: number | null;
  card_name: string;
  /** 0/1. 1 means the card landed upside down. */
  reversed: number;
  /** What the position was called in the layout, as it was then. null for a pull with no layout. */
  position_name: string | null;
  /** The person's own question for that position, while the layout still has it. */
  position_prompt: string | null;
  /** The item's picture version and description, while the item still exists and has a picture. */
  art_version: string | null;
  art_alt: string | null;
}

/** One pull from a deck. `id` is the id of its shared record in `divinations` (see lib/divinations.ts). */
export interface OraclePull {
  id: number;
  question: string | null;
  /** JSON snapshot of the sky when the pull was made. */
  sky: string | null;
  created_at: string;
  /** null when the deck has since been deleted. */
  deck_id: number | null;
  deck_name: string;
  /** The form the set had at the time of the pull. */
  deck_form: SetForm;
  /** The layout the pull used and its name as it was then. null for a pull with no layout. */
  layout_id: number | null;
  layout_name: string | null;
  /** How many entries the person has written about this pull. */
  entry_count: number;
  cards: OraclePullCard[];
}

async function findPulls(userId: number, where: { deckId?: number; id?: number }): Promise<OraclePull[]> {
  const params: number[] = [userId];
  let sql = `
    SELECT d.id, d.question, d.sky, d.created_at, p.deck_id, p.deck_name, p.deck_form, d.layout_id, d.layout_name,
           (SELECT COUNT(*)::int FROM journals j WHERE j.divination_id = d.id) AS entry_count,
           COALESCE(
             (SELECT JSON_AGG(JSON_BUILD_OBJECT('id', c.id, 'card_id', c.card_id, 'card_name', c.card_name,
                                                'reversed', c.reversed, 'position_name', c.position_name,
                                                'art_version', (SELECT TO_CHAR(a.updated_at, 'YYYYMMDDHH24MISSUS') FROM oracle_card_art a WHERE a.card_id = c.card_id),
                                                'art_alt', (SELECT a.alt FROM oracle_card_art a WHERE a.card_id = c.card_id),
                                                'position_prompt', (SELECT lp.prompt FROM layout_positions lp
                                                                    WHERE lp.layout_id = d.layout_id AND lp.name = c.position_name LIMIT 1))
                           ORDER BY c.sort_order, c.id)
              FROM oracle_pull_cards c WHERE c.divination_id = d.id),
             '[]'::json
           ) AS cards
    FROM divinations d JOIN oracle_pulls p ON p.divination_id = d.id
    WHERE d.user_id = $1 AND d.kind = 'oracle'`;
  if (where.deckId) sql += ` AND p.deck_id = $${params.push(where.deckId)}`;
  if (where.id) sql += ` AND d.id = $${params.push(where.id)}`;
  sql += " ORDER BY d.created_at DESC, d.id DESC";
  return query<OraclePull>(sql, params);
}

/** A person's pulls, newest first. With deckId, only the pulls from that deck. */
export function listPulls(userId: number, deckId?: number): Promise<OraclePull[]> {
  return findPulls(userId, { deckId });
}

/** One pull, or null when it is not theirs. */
export async function loadPull(userId: number, id: number): Promise<OraclePull | null> {
  if (!id) return null;
  return (await findPulls(userId, { id }))[0] ?? null;
}

export async function countPulls(userId: number, deckId: number): Promise<number> {
  const row = await queryOne<{ c: number }>(
    "SELECT COUNT(*)::int AS c FROM oracle_pulls WHERE user_id = $1 AND deck_id = $2",
    [userId, deckId]
  );
  return row?.c ?? 0;
}

/** An earlier time a card came up, with what the person wrote about that pull. */
export interface OracleCardPull {
  /** The id of the pull's shared record. */
  id: number;
  question: string | null;
  created_at: string;
  /** 0/1. 1 means the card landed upside down that time. */
  reversed: number;
  entries: { id: number; kind: string; content: string; created_at: string }[];
}

/**
 * The most recent pulls in which a card came up, newest first, each with the person's own entries.
 * `exceptId` leaves out one pull (the one being looked at).
 */
export async function listCardPulls(userId: number, cardId: number, exceptId = 0, limit = 5): Promise<OracleCardPull[]> {
  return query<OracleCardPull>(
    `SELECT d.id, d.question, d.created_at, c.reversed,
            COALESCE(
              (SELECT JSON_AGG(JSON_BUILD_OBJECT('id', j.id, 'kind', j.kind, 'content', j.content,
                                                 'created_at', j.created_at) ORDER BY j.created_at, j.id)
               FROM journals j WHERE j.divination_id = d.id AND j.author = 'user'),
              '[]'::json
            ) AS entries
     FROM oracle_pull_cards c JOIN divinations d ON d.id = c.divination_id
     WHERE c.card_id = $1 AND c.user_id = $2 AND d.user_id = $2 AND d.id <> $3
     ORDER BY d.created_at DESC, d.id DESC
     LIMIT $4`,
    [cardId, userId, exceptId, limit]
  );
}
