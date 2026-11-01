import { query, queryOne, withTransaction } from "./db";

// A person's own meaning for one piece of a tool's set (a hexagram, a geomantic figure), kept like a rune's or an ogham stave's: in `card_customizations`
// with every version in `card_meaning_revisions`, under the piece's id ('hexagram-12', 'geomancy-via'). Earlier versions are listed and deleted through
// /api/cards/[id]/revisions, which works for any id. The routes of the tools whose pieces have no upside-down side (I Ching, geomancy) share this; each
// route checks who is asking and that the id is a piece of its set before it calls anything here, and every query is for that one person.

const FIELDS = {
  uprightKeywords: "upright_keywords",
  reversedKeywords: "reversed_keywords",
  uprightDescription: "upright_description",
  reversedDescription: "reversed_description",
} as const;

type FieldName = keyof typeof FIELDS;
const NAMES = Object.keys(FIELDS) as FieldName[];
export type OwnFields = Record<FieldName, string | null>;

interface Row {
  upright_keywords: string | null;
  reversed_keywords: string | null;
  upright_description: string | null;
  reversed_description: string | null;
  updated_at: string;
}

async function loadRow(userId: number, id: string) {
  return queryOne<Row>(
    "SELECT upright_keywords, reversed_keywords, upright_description, reversed_description, updated_at FROM card_customizations WHERE user_id = $1 AND card_id = $2",
    [userId, id]
  );
}

function toFields(row: Row | null): OwnFields | null {
  if (!row) return null;
  const fields = {} as OwnFields;
  for (const f of NAMES) fields[f] = row[FIELDS[f]]?.trim() || null;
  return Object.values(fields).some(Boolean) ? fields : null;
}

/** The person's current words for a piece and how many earlier versions are kept. The tradition's text is never sent from here; the page shows it on a press. */
export async function readOwnMeaning(userId: number, id: string, name: string) {
  const row = await loadRow(userId, id);
  const revisions = await queryOne<{ c: string }>("SELECT COUNT(*) AS c FROM card_meaning_revisions WHERE user_id = $1 AND card_id = $2", [userId, id]);
  return {
    id,
    name,
    personal: toFields(row),
    personalUpdatedAt: row?.updated_at ?? null,
    stock: { uprightKeywords: null, reversedKeywords: null, uprightDescription: null, reversedDescription: null },
    revisionCount: Number(revisions?.c ?? 0),
  };
}

/** A field left out of the body is unchanged; an empty string or null clears it. Every change adds a version. */
export async function writeOwnMeaning(userId: number, id: string, body: Partial<Record<FieldName, string | null>> | null) {
  const current = toFields(await loadRow(userId, id));
  const next = {} as OwnFields;
  for (const field of NAMES) {
    const value = body?.[field];
    next[field] = value === undefined ? current?.[field] ?? null : typeof value === "string" ? value.trim() || null : null;
  }
  const values = NAMES.map((f) => next[f]);

  await withTransaction(async (client) => {
    if (values.every((v) => v === null)) {
      await client.query("DELETE FROM card_customizations WHERE user_id = $1 AND card_id = $2", [userId, id]);
      return;
    }
    await client.query(
      `INSERT INTO card_customizations (user_id, card_id, upright_keywords, reversed_keywords, upright_description, reversed_description, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (user_id, card_id) DO UPDATE SET
         upright_keywords     = EXCLUDED.upright_keywords,
         reversed_keywords    = EXCLUDED.reversed_keywords,
         upright_description  = EXCLUDED.upright_description,
         reversed_description = EXCLUDED.reversed_description,
         updated_at           = NOW()`,
      [userId, id, ...values]
    );
    if (NAMES.some((f) => next[f] !== (current?.[f] ?? null))) {
      await client.query(
        `INSERT INTO card_meaning_revisions (user_id, card_id, upright_keywords, reversed_keywords, upright_description, reversed_description)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, id, ...values]
      );
    }
  });
  return { ok: true, personal: values.every((v) => v === null) ? null : next };
}

/** Removes the current meaning; earlier versions stay unless `history` is true. */
export async function removeOwnMeaning(userId: number, id: string, history: boolean): Promise<void> {
  await query("DELETE FROM card_customizations WHERE user_id = $1 AND card_id = $2", [userId, id]);
  if (history) await query("DELETE FROM card_meaning_revisions WHERE user_id = $1 AND card_id = $2", [userId, id]);
}
