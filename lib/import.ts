import type { PoolClient } from "pg";
import { withTransaction } from "./db";
import { tarotSummary } from "./divinations";
import {
  importCloths, importDays, importDecks, importGuesses, importNamesAndStyles, importTarotPractice, importDailyTrials, importOwnArchetypes, importOwnMeanings, importPictures, importPredictions, importSwings, importToolReadings,
} from "./import-tools";
import {
  IMPORT_LIMITS, SECTION_LABELS, Tally, cleanCardMeaning, cleanConceptNote, cleanLayout, cleanReading, cleanSynthesis, cleanTagRow, journalKey, listOf, notImported,
  overCap, readingKey, type ImportReport, type Row, type SectionReport,
} from "./import-core";

// Brings the rows of an export into the signed-in person's account (open item ED6; the rules are in lib/import-core.ts). One transaction: either
// everything new is added or nothing is. A check (`apply: false`) runs exactly the same steps and then rolls the transaction back, so what the check
// reports is what the import then does. Only the person's own rows are read (every SELECT filters by user id) and nothing existing is changed.
// Server code only.

class RolledBack extends Error {}

/** The numbers the next `n` rows of a table will get, taken from its sequence now, so children can point at their parents in one statement. */
async function reserveIds(client: PoolClient, table: string, n: number): Promise<number[]> {
  if (n === 0) return [];
  const { rows } = await client.query(`SELECT nextval(pg_get_serial_sequence('${table}', 'id'))::int AS id FROM generate_series(1, $1)`, [n]);
  return rows.map((r: { id: number }) => r.id);
}

/** Adds many rows with few statements (a statement can hold up to 65,535 values; this keeps well below). */
async function insertMany(client: PoolClient, table: string, columns: string[], rows: unknown[][]): Promise<void> {
  const perStatement = Math.max(1, Math.floor(8000 / columns.length));
  for (let i = 0; i < rows.length; i += perStatement) {
    const chunk = rows.slice(i, i + perStatement);
    const marks = chunk.map((_, r) => `(${columns.map((_, c) => `$${r * columns.length + c + 1}`).join(", ")})`).join(", ");
    await client.query(`INSERT INTO ${table} (${columns.join(", ")}) VALUES ${marks}`, chunk.flat());
  }
}

const lower = (s: string) => s.toLowerCase();

/**
 * Checks the file and, when `apply` is true, adds what is new. Never replaces or deletes. Throws only for a database failure (then nothing is added).
 */
export async function runImport(userId: number, data: Row, apply: boolean): Promise<ImportReport> {
  const sections: SectionReport[] = [];
  try {
    await withTransaction(async (client) => {
      // The order matters: tags before the readings that carry them, sets before the pulls that draw from them, swings before the pendulum answers,
      // readings before the predictions, cloths and links that point at them.
      const tagIds = await importTags(client, userId, data, sections);
      await importLayouts(client, userId, data, sections);
      const decks = await importDecks(client, userId, data, sections);
      const swings = await importSwings(client, userId, data, sections);
      await importReadings(client, userId, data, tagIds, sections);
      await importToolReadings(client, userId, data, decks, swings, sections, tagIds);
      await importCardMeanings(client, userId, data, sections);
      await importOwnMeanings(client, userId, data, sections);
      await importConceptNotes(client, userId, data, sections);
      await importSynthesis(client, userId, data, sections);
      await importPredictions(client, userId, data, sections);
      await importGuesses(client, userId, data, sections);
      await importDays(client, userId, data, sections);
      await importOwnArchetypes(client, userId, data, sections);
      await importNamesAndStyles(client, userId, data, sections);
      await importTarotPractice(client, userId, data, sections);
      await importDailyTrials(client, userId, data, sections);
      await importCloths(client, userId, data, sections);
      // Last: a picture kept as a file is written before the transaction ends.
      await importPictures(client, userId, data, decks, apply, sections);
      if (!apply) throw new RolledBack();
    });
  } catch (err) {
    if (!(err instanceof RolledBack)) throw err;
  }
  return { applied: apply, sections: sections.filter((s) => s.add + s.have + s.left_out > 0 || s.note), not_imported: notImported(data, IMPORTED_KEYS) };
}

/** The keys of an export that some part of this import reads. */
const IMPORTED_KEYS = [
  "readings", "card_meanings", "concept_notes", "synthesis_journals", "layouts", "tags", "oracle_decks", "other_tool_readings", "own_meanings", "pendulum_swings",
  "predictions", "first_guesses", "days", "own_archetypes", "own_concepts", "own_links", "own_names", "picture_styles", "cloths", "cloth_placements", "art_gallery",
  "tarot_practice", "blind_target_daily",
];

async function importTags(client: PoolClient, userId: number, data: Row, out: SectionReport[]): Promise<Map<string, number>> {
  const t = new Tally("tags", SECTION_LABELS.tags);
  const have = new Map<string, number>();
  for (const r of (await client.query("SELECT id, name FROM tags WHERE user_id = $1", [userId])).rows as { id: number; name: string }[]) have.set(lower(r.name), r.id);
  // Tags used by the file's readings are made too, even when the tag list itself is missing.
  const wanted = new Map<string, { name: string; color: string }>();
  for (const raw of listOf(data.tags)) {
    const row = cleanTagRow(raw);
    row ? wanted.set(lower(row.name), row) : t.out(1, "A tag without a name was left out.");
  }
  for (const rd of listOf(data.readings, IMPORT_LIMITS.readings)) for (const name of Array.isArray(rd.tags) ? rd.tags : []) {
    const row = typeof name === "string" ? cleanTagRow({ name }) : null;
    if (row && !wanted.has(lower(row.name))) wanted.set(lower(row.name), row);
  }
  const fresh = [...wanted.values()].filter((w) => !have.has(lower(w.name)));
  t.had(wanted.size - fresh.length);
  t.added(fresh.length);
  const ids = await reserveIds(client, "tags", fresh.length);
  await insertMany(client, "tags", ["id", "user_id", "name", "color"], fresh.map((w, i) => [ids[i], userId, w.name, w.color]));
  fresh.forEach((w, i) => have.set(lower(w.name), ids[i]));
  out.push(t.report);
  return have;
}

async function importLayouts(client: PoolClient, userId: number, data: Row, out: SectionReport[]) {
  const t = new Tally("layouts", SECTION_LABELS.layouts);
  const have = new Set(((await client.query("SELECT name FROM layouts WHERE user_id = $1", [userId])).rows as { name: string }[]).map((r) => lower(r.name)));
  const fresh = [];
  for (const raw of listOf(data.layouts, 200)) {
    const l = cleanLayout(raw);
    if (!l) { t.out(1, "A layout that could not be read was left out."); continue; }
    if (have.has(lower(l.name))) { t.had(); continue; }
    have.add(lower(l.name));
    fresh.push(l);
  }
  t.added(fresh.length);
  const ids = await reserveIds(client, "layouts", fresh.length);
  await insertMany(client, "layouts", ["id", "user_id", "name", "description", "question", "created_at", "updated_at"], fresh.map((l, i) => [ids[i], userId, l.name, l.description, l.question, l.created_at, l.created_at]));
  await insertMany(
    client, "layout_positions", ["user_id", "layout_id", "name", "prompt", "sort_order", "color", "x", "y", "rotation"],
    fresh.flatMap((l, i) => l.positions.map((p, k) => [userId, ids[i], p.name, p.prompt, k, p.color, p.x, p.y, p.rotation]))
  );
  out.push(t.report);
}

async function importReadings(client: PoolClient, userId: number, data: Row, tagIds: Map<string, number>, out: SectionReport[]) {
  const t = new Tally("readings", SECTION_LABELS.readings);
  const over = overCap(data.readings, IMPORT_LIMITS.readings);
  if (over) t.out(over, `Only the first ${IMPORT_LIMITS.readings} readings are brought in at once.`);
  const seen = new Set<string>();
  for (const r of (await client.query("SELECT created_at, spread_name, cards FROM readings WHERE user_id = $1", [userId])).rows as { created_at: string; spread_name: string; cards: string }[]) {
    try {
      seen.add(readingKey({ created_at: r.created_at, spread_name: r.spread_name, cards: JSON.parse(r.cards) }));
    } catch { /* a reading whose cards cannot be read has no key, so nothing is matched to it */ }
  }
  const fresh = [];
  for (const raw of listOf(data.readings, IMPORT_LIMITS.readings)) {
    const rd = cleanReading(raw);
    if (!rd) { t.out(1, "A reading that could not be read (a card that is not in the deck, or no date) was left out."); continue; }
    const key = readingKey(rd);
    if (seen.has(key)) { t.had(); continue; }
    seen.add(key);
    fresh.push(rd);
  }
  fresh.sort((a, b) => a.created_at.localeCompare(b.created_at));
  t.added(fresh.length);
  const ids = await reserveIds(client, "readings", fresh.length);
  const divIds = await reserveIds(client, "divinations", fresh.length);
  await insertMany(
    client, "readings", ["id", "user_id", "spread_name", "title", "question", "cards", "clarifiers", "notes", "created_at", "sky"],
    fresh.map((r, i) => [ids[i], userId, r.spread_name, r.title, r.question, JSON.stringify(r.cards), Object.keys(r.clarifiers).length ? JSON.stringify(r.clarifiers) : null, r.notes, r.created_at, r.sky])
  );
  await insertMany(
    client, "divinations", ["id", "user_id", "kind", "title", "question", "summary", "sky", "reading_id", "created_at"],
    fresh.map((r, i) => [divIds[i], userId, "tarot", r.title, r.question, tarotSummary(r.cards), r.sky, ids[i], r.created_at])
  );
  // Which tag goes on which reading.
  await insertMany(
    client, "reading_tags", ["reading_id", "tag_id"],
    fresh.flatMap((r, i) => r.tags.flatMap((name) => (tagIds.has(lower(name)) ? [[ids[i], tagIds.get(lower(name))!]] : [])))
  );
  // What the person wrote about each reading. Exact repeats inside one reading are dropped.
  const journalRows: unknown[][] = [];
  fresh.forEach((r, i) => {
    const kept = new Set<string>();
    for (const j of r.journals) {
      const k = journalKey(j);
      if (kept.has(k)) continue;
      kept.add(k);
      journalRows.push([ids[i], j.author, j.content, j.card_index, j.clarifier_index, j.created_at, j.kind, j.card_id]);
    }
  });
  await insertMany(client, "journals", ["reading_id", "author", "content", "card_index", "clarifier_index", "created_at", "kind", "card_id"], journalRows);
  // The record of each card drawn, which Patterns counts from.
  const draws: unknown[][] = [];
  fresh.forEach((r, i) => {
    r.cards.forEach((c, ci) => {
      draws.push([userId, ids[i], c.card_id, c.card_name, c.position, r.spread_name, c.reversed ? 1 : 0, 0, null, null, r.created_at]);
      for (const cl of r.clarifiers[ci] ?? []) draws.push([userId, ids[i], cl.card_id, cl.card_name, cl.position, r.spread_name, cl.reversed ? 1 : 0, 1, c.card_id, c.position, r.created_at]);
    });
  });
  await insertMany(
    client, "card_draws",
    ["user_id", "reading_id", "card_id", "card_name", "position_name", "spread_name", "reversed", "is_clarifier", "clarifies_card_id", "clarifies_position", "created_at"], draws
  );
  out.push(t.report);
}

async function importCardMeanings(client: PoolClient, userId: number, data: Row, out: SectionReport[]) {
  const t = new Tally("card_meanings", SECTION_LABELS.card_meanings);
  const have = new Set(((await client.query("SELECT card_id FROM card_customizations WHERE user_id = $1", [userId])).rows as { card_id: string }[]).map((r) => r.card_id));
  const custom: unknown[][] = [];
  const revisions: unknown[][] = [];
  for (const raw of listOf(data.card_meanings, 200)) {
    const m = cleanCardMeaning(raw);
    if (!m) { t.out(1, "A card meaning that could not be read was left out."); continue; }
    // A card the person already has their own words for is left as it is, with its earlier versions.
    if (have.has(m.card_id)) { t.had(); continue; }
    have.add(m.card_id);
    t.added();
    if (m.current) custom.push([userId, m.card_id, m.current.upright_keywords, m.current.reversed_keywords, m.current.upright_description, m.current.reversed_description, m.current.updated_at]);
    for (const h of m.history) revisions.push([userId, m.card_id, h.upright_keywords, h.reversed_keywords, h.upright_description, h.reversed_description, h.saved_at]);
  }
  await insertMany(client, "card_customizations", ["user_id", "card_id", "upright_keywords", "reversed_keywords", "upright_description", "reversed_description", "updated_at"], custom);
  await insertMany(client, "card_meaning_revisions", ["user_id", "card_id", "upright_keywords", "reversed_keywords", "upright_description", "reversed_description", "created_at"], revisions);
  out.push(t.report);
}

async function importConceptNotes(client: PoolClient, userId: number, data: Row, out: SectionReport[]) {
  const t = new Tally("concept_notes", SECTION_LABELS.concept_notes);
  const concepts = new Map<string, number>();
  // A concept reworded since the file was made is still found by its older wording (concepts.aliases, migration 084).
  const conceptRows = (await client.query("SELECT id, display_name, aliases FROM concepts")).rows as { id: number; display_name: string; aliases: string[] }[];
  for (const c of conceptRows) for (const alias of c.aliases) concepts.set(lower(alias), c.id);
  for (const c of conceptRows) concepts.set(lower(c.display_name), c.id);
  const have = new Set(((await client.query("SELECT concept_id FROM concept_notes WHERE user_id = $1", [userId])).rows as { concept_id: number }[]).map((r) => r.concept_id));
  const rows: unknown[][] = [];
  for (const raw of listOf(data.concept_notes, 3000)) {
    const n = cleanConceptNote(raw);
    if (!n) { t.out(1, "A note that could not be read was left out."); continue; }
    const id = concepts.get(lower(n.concept));
    if (!id) { t.out(1, "A note on a concept this copy does not have (the encyclopedia is not loaded here) was left out."); continue; }
    if (have.has(id)) { t.had(); continue; }
    have.add(id);
    t.added();
    rows.push([userId, id, n.content, n.updated_at]);
  }
  await insertMany(client, "concept_notes", ["user_id", "concept_id", "content", "updated_at"], rows);
  out.push(t.report);
}

async function importSynthesis(client: PoolClient, userId: number, data: Row, out: SectionReport[]) {
  const t = new Tally("synthesis_journals", SECTION_LABELS.synthesis_journals);
  const have = new Set(((await client.query("SELECT prompt, created_at FROM synthesis_journals WHERE user_id = $1", [userId])).rows as { prompt: string; created_at: string }[]).map((r) => `${new Date(r.created_at).toISOString().slice(0, 19)}|${r.prompt.trim()}`));
  const rows: unknown[][] = [];
  for (const raw of listOf(data.synthesis_journals, 2000)) {
    const s = cleanSynthesis(raw);
    if (!s) { t.out(1, "A synthesis journal that could not be read was left out."); continue; }
    const key = `${s.created_at.slice(0, 19)}|${s.prompt}`;
    if (have.has(key)) { t.had(); continue; }
    have.add(key);
    t.added();
    rows.push([userId, s.prompt, s.content, s.created_at]);
  }
  await insertMany(client, "synthesis_journals", ["user_id", "prompt", "content", "created_at"], rows);
  out.push(t.report);
}
