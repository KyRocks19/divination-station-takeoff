import { query } from "./db";
import { DIVINATION_KIND_LABELS, divinationPath, type DivinationKind } from "./divination-kinds";
import { meaningPiece } from "./search-core";
import {
  MAX_POOL,
  MIN_PIECE_CHARS,
  SOURCE_FALLBACK_LABEL,
  SOURCE_KINDS,
  uniformIndex,
  unitsOf,
  weightedIndex,
  type SourceKind,
  type Unit,
} from "./bibliomancy-core";

export * from "./bibliomancy-core";

// Bibliomancy, the database side (migration 082). The app picks a piece of the person's own writing and a place in it by chance, with the random method
// the person set in Settings, and keeps what it pulled as it was. Every query is for one person, and only writing the person made is read: a journal
// entry with the author 'user' (never one an AI wrote), a day page, the notes on a tarot reading, a prediction, or a meaning the person wrote.

interface Candidate {
  kind: SourceKind;
  /** What finds the text again: a row id, a day, or "cc:<card id>" / "om:<meaning id>" for the two kinds of meaning. */
  ref: string;
  len: number;
  when: string | Date | null;
  label: string;
  /** The page the writing is on, while it exists. */
  href: string | null;
}

const toolWords = (kind: string | null) => (kind && DIVINATION_KIND_LABELS[kind as DivinationKind]) || "Tarot";

async function candidatesOf(userId: number, kind: SourceKind): Promise<Candidate[]> {
  const limit = `LIMIT ${MAX_POOL}`;
  const min = MIN_PIECE_CHARS;
  if (kind === "journal") {
    const rows = await query<{ ref: string; len: number; at: string; tarot_reading: number | null; kind: string | null; divination_id: number | null; d_reading_id: number | null }>(
      `SELECT j.id::text AS ref, LENGTH(j.content) AS len, j.created_at AS at, j.reading_id AS tarot_reading, d.kind, d.id AS divination_id, d.reading_id AS d_reading_id
       FROM journals j LEFT JOIN readings r ON r.id = j.reading_id LEFT JOIN divinations d ON d.id = j.divination_id
       WHERE COALESCE(r.user_id, d.user_id) = $1 AND j.author = 'user' AND LENGTH(j.content) >= ${min}
       ORDER BY j.created_at DESC ${limit}`,
      [userId]
    );
    return rows.map((r) => ({
      kind,
      ref: r.ref,
      len: r.len,
      when: r.at,
      label: `Journal on a ${toolWords(r.tarot_reading ? "tarot" : r.kind)} reading`,
      href: r.tarot_reading ? `/readings/${r.tarot_reading}` : divinationPath((r.kind ?? "tarot") as DivinationKind, r.divination_id ?? 0, r.d_reading_id),
    }));
  }
  if (kind === "day") {
    const rows = await query<{ ref: string; len: number }>(
      `SELECT day::text AS ref, LENGTH(body) AS len FROM day_entries WHERE user_id = $1 AND LENGTH(body) >= ${min} ORDER BY day DESC ${limit}`,
      [userId]
    );
    return rows.map((r) => ({ kind, ref: r.ref, len: r.len, when: r.ref, label: `Day page of ${r.ref}`, href: `/days/${r.ref}` }));
  }
  if (kind === "notes") {
    const rows = await query<{ ref: string; len: number; at: string }>(
      `SELECT id::text AS ref, LENGTH(notes) AS len, created_at AS at FROM readings WHERE user_id = $1 AND notes IS NOT NULL AND LENGTH(notes) >= ${min} ORDER BY created_at DESC ${limit}`,
      [userId]
    );
    return rows.map((r) => ({ kind, ref: r.ref, len: r.len, when: r.at, label: "Notes on a tarot reading", href: `/readings/${r.ref}` }));
  }
  if (kind === "prediction") {
    const rows = await query<{ ref: string; len: number; at: string; kind: string; divination_id: number; reading_id: number | null }>(
      `SELECT p.id::text AS ref, LENGTH(p.text) AS len, p.created_at AS at, d.kind, d.id AS divination_id, d.reading_id
       FROM predictions p JOIN divinations d ON d.id = p.divination_id
       WHERE p.user_id = $1 AND d.user_id = $1 AND LENGTH(p.text) >= ${min}
       ORDER BY p.created_at DESC ${limit}`,
      [userId]
    );
    return rows.map((r) => ({
      kind,
      ref: r.ref,
      len: r.len,
      when: r.at,
      label: `Prediction on a ${toolWords(r.kind)} reading`,
      href: divinationPath(r.kind as DivinationKind, r.divination_id, r.reading_id),
    }));
  }
  // The person's own meanings: for tarot cards, runes, staves, faces, hexagrams and figures, and for items of their oracle sets.
  const [custom, oracle] = await Promise.all([
    query<{ card_id: string; len: number; at: string }>(
      `SELECT card_id, LENGTH(concat_ws(E'\\n', upright_keywords, upright_description, reversed_keywords, reversed_description)) AS len, updated_at AS at
       FROM card_customizations WHERE user_id = $1
         AND LENGTH(concat_ws(E'\\n', upright_keywords, upright_description, reversed_keywords, reversed_description)) >= ${min}
       ORDER BY updated_at DESC ${limit}`,
      [userId]
    ),
    query<{ id: number; card_id: number; name: string; len: number; at: string }>(
      `SELECT m.id, m.card_id, c.name, LENGTH(m.content) AS len, m.updated_at AS at
       FROM oracle_card_meanings m JOIN oracle_cards c ON c.id = m.card_id
       WHERE m.user_id = $1 AND c.user_id = $1 AND LENGTH(m.content) >= ${min}
       ORDER BY m.updated_at DESC ${limit}`,
      [userId]
    ),
  ]);
  const out: Candidate[] = [];
  for (const r of custom) {
    const piece = meaningPiece(r.card_id);
    if (piece) out.push({ kind, ref: `cc:${r.card_id}`, len: r.len, when: r.at, label: `Your meaning for ${piece.label}`, href: piece.href });
  }
  for (const r of oracle) out.push({ kind, ref: `om:${r.id}`, len: r.len, when: r.at, label: `Your meaning for ${r.name}`, href: `/oracle/cards/${r.card_id}` });
  return out;
}

/** The text of one candidate, when it is still the person's and still there. */
async function textOf(userId: number, c: Candidate): Promise<string | null> {
  const one = async (sql: string, params: unknown[]) => (await query<{ text: string | null }>(sql, params))[0]?.text ?? null;
  switch (c.kind) {
    case "journal":
      return one(
        `SELECT j.content AS text FROM journals j LEFT JOIN readings r ON r.id = j.reading_id LEFT JOIN divinations d ON d.id = j.divination_id
         WHERE j.id = $1::int AND j.author = 'user' AND COALESCE(r.user_id, d.user_id) = $2`,
        [c.ref, userId]
      );
    case "day":
      return one("SELECT body AS text FROM day_entries WHERE day = $1::date AND user_id = $2", [c.ref, userId]);
    case "notes":
      return one("SELECT notes AS text FROM readings WHERE id = $1::int AND user_id = $2", [c.ref, userId]);
    case "prediction":
      return one("SELECT text FROM predictions WHERE id = $1::int AND user_id = $2", [c.ref, userId]);
    case "meaning":
      return c.ref.startsWith("om:")
        ? one("SELECT content AS text FROM oracle_card_meanings WHERE id = $1::int AND user_id = $2", [c.ref.slice(3), userId])
        : one(
            "SELECT concat_ws(E'\\n', upright_keywords, upright_description, reversed_keywords, reversed_description) AS text FROM card_customizations WHERE card_id = $1 AND user_id = $2",
            [c.ref.slice(3), userId]
          );
  }
}

/** How many pieces of writing the person has to pull from in each place (up to the most recent MAX_POOL). */
export async function poolCounts(userId: number): Promise<Record<SourceKind, number>> {
  const out = {} as Record<SourceKind, number>;
  await Promise.all(SOURCE_KINDS.map(async (k) => (out[k] = (await candidatesOf(userId, k)).length)));
  return out;
}

export interface PulledPassage {
  unit: Unit;
  passage: string;
  context: string | null;
  source_kind: SourceKind;
  /** The page of the writing it came from, while it exists. */
  source_ref: string | null;
  source_label: string;
  source_when: string | null;
}

/**
 * Pulls `count` passages from the person's own writing in the places `kinds`: a piece of writing is chosen with the chance of each in proportion to its
 * length (so every stretch of text is as likely as any other), then one word, phrase or sentence of it with equal chances. The same passage from the same
 * piece is never pulled twice in one reading. An error message, in plain words, when there is not enough to pull from.
 */
export async function pullFromWriting(
  userId: number,
  kinds: SourceKind[],
  unit: Unit,
  count: number,
  rng: () => number
): Promise<{ pulls: PulledPassage[] } | { error: string }> {
  const lists = await Promise.all(kinds.map((k) => candidatesOf(userId, k)));
  const pool = lists.flat();
  if (pool.length === 0) return { error: "There is no writing of yours in the places you chose yet. Write a little more, or choose another place." };

  const weights = pool.map((c) => c.len);
  const texts = new Map<number, string | null>();
  const pulls: PulledPassage[] = [];
  const taken = new Set<string>();
  let attempts = 0;
  while (pulls.length < count && attempts < 60) {
    attempts++;
    const i = weightedIndex(weights, rng);
    if (i < 0) break;
    if (!texts.has(i)) texts.set(i, await textOf(userId, pool[i]));
    const text = texts.get(i);
    const units = text ? unitsOf(text, unit) : [];
    if (units.length === 0) {
      // Nothing to pull from this piece (for example no word of four letters): take it out of the draw.
      weights[i] = 0;
      continue;
    }
    const u = units[uniformIndex(units.length, rng)];
    const key = `${i}|${u.passage}`;
    if (taken.has(key)) continue;
    taken.add(key);
    const c = pool[i];
    pulls.push({
      unit,
      passage: u.passage,
      context: u.context,
      source_kind: c.kind,
      source_ref: c.href,
      source_label: c.label || SOURCE_FALLBACK_LABEL[c.kind],
      source_when: c.when ? new Date(c.when).toISOString() : null,
    });
  }
  if (pulls.length === 0) return { error: `Your writing in those places has no ${unit === "word" ? "word of four letters or more" : unit} to pull yet.` };
  return { pulls };
}

// ── Readings ─────────────────────────────────────────────────────────────────────────────────────────

/** One reading. `id` is the id of its shared record in `divinations`. */
export interface BibliomancyReading {
  id: number;
  question: string | null;
  /** JSON snapshot of the sky when the pull was made. */
  sky: string | null;
  created_at: string;
  pulls: { unit: Unit; passage: string; context: string | null; source_kind: string; source_ref: string | null; source_label: string; source_when: string | null }[];
  /** How many entries the person has written about this reading. */
  entry_count: number;
}

async function findReadings(userId: number, id?: number): Promise<BibliomancyReading[]> {
  const params: number[] = [userId];
  let sql = `
    SELECT d.id, d.question, d.sky, d.created_at,
           (SELECT COUNT(*)::int FROM journals j WHERE j.divination_id = d.id) AS entry_count
    FROM divinations d
    WHERE d.user_id = $1 AND d.kind = 'bibliomancy'`;
  if (id) sql += ` AND d.id = $${params.push(id)}`;
  sql += " ORDER BY d.created_at DESC, d.id DESC";
  const readings = await query<Omit<BibliomancyReading, "pulls">>(sql, params);
  if (readings.length === 0) return [];
  const rows = await query<BibliomancyReading["pulls"][number] & { divination_id: number }>(
    `SELECT divination_id, unit, passage, context, source_kind, source_ref, source_label, source_when
     FROM bibliomancy_pulls WHERE user_id = $1 AND divination_id = ANY($2) ORDER BY sort_order, id`,
    [userId, readings.map((r) => r.id)]
  );
  return readings.map((r) => ({ ...r, pulls: rows.filter((p) => p.divination_id === r.id) }));
}

export function listReadings(userId: number): Promise<BibliomancyReading[]> {
  return findReadings(userId);
}

export async function loadReading(userId: number, id: number): Promise<BibliomancyReading | null> {
  if (!id) return null;
  return (await findReadings(userId, id))[0] ?? null;
}
