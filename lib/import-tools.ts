import type { PoolClient } from "pg";
import { ARCHETYPES } from "./archetypes-data";
import { BUILTIN_SWINGS } from "./pendulum-swings";
import { castRow, cleanLineValues } from "./iching-data";
import { buildChart, chartRows, mothersFromText } from "./geomancy-data";
import { LIMITS } from "./own-limits";
import { MAX_CLOTHS } from "./cloth-core";
import { MAX_ART_STYLES } from "./art-styles-core";
import { MAX_ITEMS_PER_DAY } from "./days-core";
import { Tally, isoDate, listOf, type Row, type SectionReport } from "./import-core";
import { artDir, dbBudgetBytes, placeBytes } from "./art-store";
import { MAX_GALLERY_ITEMS, MAX_PROMPT_LENGTH, cleanAlt, cleanDrawing } from "./oracle-art";
import { maxPictureBytes, parseImageDataUrl } from "./oracle-gallery";
import { cleanMadeWith } from "./art-maker";
import { cleanTags } from "./gallery-tags-core";
import {
  cleanClothRow, cleanDay, cleanDeck, cleanGuessIn, cleanPracticeRow, cleanNameRow, cleanOwnArchetypeRow, cleanOwnConceptRow, cleanDailyTrialRow, cleanOwnMeaning, cleanPrediction, cleanStyleRow, cleanSwing,
  cleanToolReading, groupPlacements, swingKey, toolReadingKey, type DeckIn,
} from "./import-tools-core";

// The other tools' parts of the import (open item ED6, part 2). Same rules as lib/import.ts: only adds, every SELECT is for the person, one
// transaction. These run inside the transaction lib/import.ts opens, so a check rolls them back with the rest. Server code only.

/** The numbers the next `n` rows of a table will get, taken from its sequence now (see lib/import.ts). */
async function reserveIds(client: PoolClient, table: string, n: number): Promise<number[]> {
  if (n === 0) return [];
  const { rows } = await client.query(`SELECT nextval(pg_get_serial_sequence('${table}', 'id'))::int AS id FROM generate_series(1, $1)`, [n]);
  return rows.map((r: { id: number }) => r.id);
}

async function insertMany(client: PoolClient, table: string, columns: string[], rows: unknown[][]): Promise<void> {
  const perStatement = Math.max(1, Math.floor(8000 / columns.length));
  for (let i = 0; i < rows.length; i += perStatement) {
    const chunk = rows.slice(i, i + perStatement);
    const marks = chunk.map((_, r) => `(${columns.map((_, c) => `$${r * columns.length + c + 1}`).join(", ")})`).join(", ");
    await client.query(`INSERT INTO ${table} (${columns.join(", ")}) VALUES ${marks}`, chunk.flat());
  }
}

const lower = (s: string) => s.toLowerCase();
const sec = (d: string | Date) => new Date(d).toISOString().slice(0, 19);

// ── Own meanings for runes, ogham and dice ───────────────────────────────────────────────────────────

export async function importOwnMeanings(client: PoolClient, userId: number, data: Row, out: SectionReport[]) {
  const t = new Tally("own_meanings", "Your own meanings for runes, ogham staves and dice faces (with earlier versions)");
  const have = new Set(((await client.query("SELECT card_id FROM card_customizations WHERE user_id = $1", [userId])).rows as { card_id: string }[]).map((r) => r.card_id));
  const custom: unknown[][] = [];
  const revisions: unknown[][] = [];
  for (const raw of listOf(data.own_meanings, 2000)) {
    const m = cleanOwnMeaning(raw);
    if (!m) { t.out(1, "A meaning that could not be read was left out."); continue; }
    if (have.has(m.symbol)) { t.had(); continue; }
    have.add(m.symbol);
    t.added();
    if (m.current) custom.push([userId, m.symbol, m.current.upright_keywords, m.current.reversed_keywords, m.current.upright_description, m.current.reversed_description, m.current.updated_at]);
    for (const h of m.history) revisions.push([userId, m.symbol, h.upright_keywords, h.reversed_keywords, h.upright_description, h.reversed_description, h.saved_at]);
  }
  await insertMany(client, "card_customizations", ["user_id", "card_id", "upright_keywords", "reversed_keywords", "upright_description", "reversed_description", "updated_at"], custom);
  await insertMany(client, "card_meaning_revisions", ["user_id", "card_id", "upright_keywords", "reversed_keywords", "upright_description", "reversed_description", "created_at"], revisions);
  out.push(t.report);
}

// ── Pendulum swings ──────────────────────────────────────────────────────────────────────────────────

/** Adds the swings the person does not have; answers the number of each swing by its key, for the pendulum readings that follow. */
export async function importSwings(client: PoolClient, userId: number, data: Row, out: SectionReport[]): Promise<Map<string, number>> {
  const t = new Tally("pendulum_swings", "Pendulum swings (with your words and earlier wordings)");
  const ids = new Map<string, number>();
  for (const s of (await client.query("SELECT id, shape, angle, angle_tenths FROM pendulum_swings WHERE user_id = $1", [userId])).rows as { id: number; shape: string; angle: number | null; angle_tenths: number }[]) {
    ids.set(swingKey({ shape: s.shape, angle: s.angle, tenths: s.angle_tenths }), s.id);
  }
  const maxOrder = Number(((await client.query("SELECT COALESCE(MAX(sort_order), 0)::int AS m FROM pendulum_swings WHERE user_id = $1", [userId])).rows[0] as { m: number }).m);
  const fresh = [];
  for (const raw of listOf(data.pendulum_swings, 2000)) {
    const s = cleanSwing(raw);
    if (!s) { t.out(1, "A swing that could not be read was left out."); continue; }
    if (ids.has(swingKey(s))) { t.had(); continue; }
    ids.set(swingKey(s), -1);
    fresh.push(s);
  }
  t.added(fresh.length);
  const newIds = await reserveIds(client, "pendulum_swings", fresh.length);
  // The starting swings are the app's own five; one that comes in keeps that place, so the pendulum does not add them again later (ensureSwings).
  const builtinIndex = (s: { shape: string; angle: number | null; tenths: number }) => BUILTIN_SWINGS.findIndex((b) => b.shape === s.shape && b.angle === s.angle && s.tenths === 0);
  await insertMany(
    client, "pendulum_swings", ["id", "user_id", "shape", "angle", "name", "builtin", "meaning", "in_play", "sort_order", "angle_tenths"],
    fresh.map((s, i) => {
      const b = builtinIndex(s);
      return [newIds[i], userId, s.shape, s.angle, b >= 0 ? null : s.name, b >= 0 ? 1 : 0, s.meaning, s.in_play ? 1 : 0, b >= 0 ? b : maxOrder + i + 1, s.tenths];
    })
  );
  fresh.forEach((s, i) => ids.set(swingKey(s), newIds[i]));
  await insertMany(client, "pendulum_swing_revisions", ["user_id", "swing_id", "content", "created_at"], fresh.flatMap((s, i) => s.history.map((h) => [userId, newIds[i], h.content, h.saved_at])));
  out.push(t.report);
  return ids;
}

// ── The person's own oracle sets ─────────────────────────────────────────────────────────────────────

export interface DeckMaps {
  /** The set's number and form, by its name in lower case. */
  decks: Map<string, { id: number; form: string }>;
  /** An item's number, by the set's name and the item's name, both in lower case. */
  cards: Map<string, number>;
}

export async function importDecks(client: PoolClient, userId: number, data: Row, out: SectionReport[]): Promise<DeckMaps> {
  const t = new Tally("oracle_decks", "Your oracle sets (items, their fields and meanings with earlier versions)");
  const maps: DeckMaps = { decks: new Map(), cards: new Map() };
  for (const d of (await client.query("SELECT id, name, form FROM oracle_decks WHERE user_id = $1", [userId])).rows as { id: number; name: string; form: string }[]) maps.decks.set(lower(d.name), { id: d.id, form: d.form });
  for (const c of (await client.query("SELECT c.id, c.name, d.name AS deck FROM oracle_cards c JOIN oracle_decks d ON d.id = c.deck_id WHERE c.user_id = $1 AND d.user_id = $1", [userId])).rows as { id: number; name: string; deck: string }[]) {
    if (!maps.cards.has(`${lower(c.deck)}|${lower(c.name)}`)) maps.cards.set(`${lower(c.deck)}|${lower(c.name)}`, c.id);
  }
  const owned = Number(((await client.query("SELECT COUNT(*)::int AS n FROM oracle_decks WHERE user_id = $1", [userId])).rows[0] as { n: number }).n);
  const fresh: DeckIn[] = [];
  let pictures = 0;
  for (const raw of listOf(data.oracle_decks, 200)) {
    const d = cleanDeck(raw);
    if (!d) { t.out(1, "A set that could not be read was left out."); continue; }
    if (maps.decks.has(lower(d.name))) { t.had(); continue; }
    if (owned + fresh.length >= 60) { t.out(1, "A person can have 60 sets, so the rest were left out."); continue; }
    maps.decks.set(lower(d.name), { id: -1, form: d.form });
    fresh.push(d);
    pictures += d.cards.filter((c) => c.picture).length;
  }
  t.added(fresh.length);
  void pictures; // the pictures of new sets come in at the end (importPictures), once every item has its number
  const deckIds = await reserveIds(client, "oracle_decks", fresh.length);
  const cardCount = fresh.reduce((s, d) => s + d.cards.length, 0);
  const cardIds = await reserveIds(client, "oracle_cards", cardCount);
  const meaningCount = fresh.reduce((s, d) => s + d.cards.reduce((m, c) => m + c.meanings.length, 0), 0);
  const meaningIds = await reserveIds(client, "oracle_card_meanings", meaningCount);
  await insertMany(
    client, "oracle_decks", ["id", "user_id", "name", "description", "reversals", "created_at", "updated_at", "reversal_chance", "form", "art_style"],
    fresh.map((d, i) => [deckIds[i], userId, d.name, d.description, d.reversals ? 1 : 0, d.created_at, d.created_at, d.reversal_chance, d.form, d.art_style])
  );
  let ci = 0, mi = 0;
  const cardRows: unknown[][] = [], fieldRows: unknown[][] = [], meaningRows: unknown[][] = [], revisionRows: unknown[][] = [];
  fresh.forEach((d, di) => {
    maps.decks.set(lower(d.name), { id: deckIds[di], form: d.form });
    d.cards.forEach((c, k) => {
      const cardId = cardIds[ci++];
      if (!maps.cards.has(`${lower(d.name)}|${lower(c.name)}`)) maps.cards.set(`${lower(d.name)}|${lower(c.name)}`, cardId);
      cardRows.push([cardId, userId, deckIds[di], c.name, c.origin, d.created_at, d.created_at, k, c.resting ? 1 : 0]);
      c.fields.forEach((f, fi) => fieldRows.push([userId, cardId, f.name, f.value, fi, d.created_at, d.created_at]));
      c.meanings.forEach((m, k2) => {
        const mid = meaningIds[mi++];
        meaningRows.push([mid, userId, cardId, m.label, m.content, m.reversed ? 1 : 0, k2, m.updated_at, m.updated_at]);
        for (const h of m.history) revisionRows.push([userId, mid, h.label, h.content, h.saved_at]);
      });
    });
  });
  await insertMany(client, "oracle_cards", ["id", "user_id", "deck_id", "name", "origin", "created_at", "updated_at", "sort_order", "resting"], cardRows);
  await insertMany(client, "oracle_card_fields", ["user_id", "card_id", "name", "value", "sort_order", "created_at", "updated_at"], fieldRows);
  await insertMany(client, "oracle_card_meanings", ["id", "user_id", "card_id", "label", "content", "reversed", "sort_order", "created_at", "updated_at"], meaningRows);
  await insertMany(client, "oracle_card_meaning_revisions", ["user_id", "meaning_id", "label", "content", "created_at"], revisionRows);
  out.push(t.report);
  return maps;
}

// ── Readings of the other tools ──────────────────────────────────────────────────────────────────────

export async function importToolReadings(client: PoolClient, userId: number, data: Row, decks: DeckMaps, swings: Map<string, number>, out: SectionReport[], tagIds: Map<string, number> = new Map()) {
  const t = new Tally("other_tool_readings", "Readings of runes, ogham, dice and coins, oracle sets, the pendulum, scrying, the I Ching, geomancy, bibliomancy, playing cards, charm casting, signs and dreams, blind-target practice, tea leaves, and ink blots (with their journals)");
  const seen = new Set<string>();
  for (const r of (await client.query("SELECT kind, created_at, summary FROM divinations WHERE user_id = $1 AND kind <> 'tarot'", [userId])).rows as { kind: string; created_at: string; summary: string }[]) seen.add(toolReadingKey(r));
  const fresh = [];
  for (const raw of listOf(data.other_tool_readings, 5000)) {
    const r = cleanToolReading(raw);
    if (!r) { t.out(1, "A reading that could not be read (an item this copy does not have, or no date) was left out."); continue; }
    const key = toolReadingKey({ kind: r.detail.kind, created_at: r.created_at, summary: r.summary });
    if (seen.has(key)) { t.had(); continue; }
    seen.add(key);
    fresh.push(r);
  }
  fresh.sort((a, b) => a.created_at.localeCompare(b.created_at));
  t.added(fresh.length);
  const ids = await reserveIds(client, "divinations", fresh.length);
  await insertMany(client, "divinations", ["id", "user_id", "kind", "title", "question", "summary", "sky", "created_at", "layout_name"], fresh.map((r, i) => [ids[i], userId, r.detail.kind, r.title, r.question, r.summary, r.sky, r.created_at, r.layout_name]));
  const runes: unknown[][] = [], ogham: unknown[][] = [], dice: unknown[][] = [], pulls: unknown[][] = [], pullCards: unknown[][] = [], scrying: unknown[][] = [], answers: unknown[][] = [], journals: unknown[][] = [];
  const casts: unknown[][] = [], charts: unknown[][] = [], chartFigures: unknown[][] = [], passages: unknown[][] = [];
  const blotInserts: unknown[][] = [], playing: unknown[][] = [], charmRows: unknown[][] = [], signRows: unknown[][] = [], trialRows: unknown[][] = [];
  fresh.forEach((r, i) => {
    const id = ids[i];
    const d = r.detail;
    if (d.kind === "runes") d.items.forEach((x, k) => runes.push([userId, id, x.id, x.name, x.reversed ? 1 : 0, k, x.position]));
    else if (d.kind === "ogham") d.items.forEach((x, k) => ogham.push([userId, id, x.id, x.name, k, x.position]));
    else if (d.kind === "dice") d.items.forEach((x, k) => dice.push([userId, id, x.object, x.face, x.position, k]));
    else if (d.kind === "oracle") {
      const deck = decks.decks.get(lower(d.deck));
      pulls.push([id, userId, deck && deck.id > 0 ? deck.id : null, d.deck, deck?.form ?? "cards"]);
      d.cards.forEach((c, k) => pullCards.push([userId, id, decks.cards.get(`${lower(d.deck)}|${lower(c.name)}`) ?? null, c.name, c.reversed ? 1 : 0, k, c.position]));
    } else if (d.kind === "scrying") scrying.push([id, userId, d.surface, d.minutes]);
    else if (d.kind === "iching") {
      const row = castRow(cleanLineValues(d.lines)!);
      casts.push([id, userId, d.method, d.lines, row.primary_number, row.primary_name, row.relating_number, row.relating_name]);
    } else if (d.kind === "geomancy") {
      charts.push([id, userId, d.method, d.mothers]);
      for (const f of chartRows(buildChart(mothersFromText(d.mothers)!))) chartFigures.push([userId, id, f.place, f.figure.id, f.figure.latin, f.order]);
    } else if (d.kind === "tea" || d.kind === "blots") {
      blotInserts.push([userId, id, d.vessel, d.seed, d.tea]);
    } else if (d.kind === "playingcards") {
      d.cards.forEach((c, k) => playing.push([userId, id, k, c.id, c.name]));
    } else if (d.kind === "charms") {
      d.charms.forEach((c, k) => charmRows.push([userId, id, k, d.set, decks.cards.get(`${lower(d.set)}|${lower(c.name)}`) ?? null, c.name, c.x, c.y, c.face]));
    } else if (d.kind === "signs") {
      signRows.push([userId, id, d.type, d.body, d.day]);
    } else if (d.kind === "remoteview") {
      trialRows.push([userId, id, JSON.stringify(d.options), d.target, d.impression, r.created_at, d.choice, r.created_at, d.ideogram ? JSON.stringify(d.ideogram) : null]);
    } else if (d.kind === "bibliomancy") {
      d.pulls.forEach((x, k) => passages.push([userId, id, k, x.unit, x.passage, x.context, x.source_kind, null, x.source_label, x.source_when]));
    } else {
      const s = d.swing;
      const swingId = swings.get(swingKey({ shape: s.shape, angle: s.angle, tenths: s.tenths }));
      answers.push([id, userId, swingId && swingId > 0 ? swingId : null, s.shape, s.angle, s.name, s.meaning, s.tenths, s.chosen_by, s.motion_shape, s.motion_angle]);
    }
    const kept = new Set<string>();
    for (const j of r.journals) {
      const k = `${sec(j.created_at)}|${j.author}|${j.content.trim()}`;
      if (kept.has(k)) continue;
      kept.add(k);
      journals.push([id, j.author, j.content, j.created_at, j.kind]);
    }
  });
  await insertMany(client, "rune_draws", ["user_id", "divination_id", "rune_id", "rune_name", "reversed", "sort_order", "position_name"], runes);
  await insertMany(client, "ogham_draws", ["user_id", "divination_id", "stave_id", "stave_name", "sort_order", "position_name"], ogham);
  await insertMany(client, "dice_throws", ["user_id", "divination_id", "object", "face", "position_name", "sort_order"], dice);
  await insertMany(client, "oracle_pulls", ["divination_id", "user_id", "deck_id", "deck_name", "deck_form"], pulls);
  await insertMany(client, "oracle_pull_cards", ["user_id", "divination_id", "card_id", "card_name", "reversed", "sort_order", "position_name"], pullCards);
  await insertMany(client, "scrying_sessions", ["divination_id", "user_id", "surface", "minutes"], scrying);
  // Tags on the readings (migration 083): matched to the person's tags by name.
  const tagRows: unknown[][] = [];
  fresh.forEach((r, i) => {
    for (const name of new Set(r.tags.map((n) => n.toLowerCase()))) if (tagIds.has(name)) tagRows.push([ids[i], tagIds.get(name)!]);
  });
  await insertMany(client, "divination_tags", ["divination_id", "tag_id"], tagRows);
  await insertMany(client, "iching_casts", ["divination_id", "user_id", "method", "lines", "primary_number", "primary_name", "relating_number", "relating_name"], casts);
  await insertMany(client, "geomancy_charts", ["divination_id", "user_id", "method", "mothers"], charts);
  await insertMany(client, "geomancy_figures", ["user_id", "divination_id", "place", "figure_id", "figure_name", "sort_order"], chartFigures);
  await insertMany(client, "bibliomancy_pulls", ["user_id", "divination_id", "sort_order", "unit", "passage", "context", "source_kind", "source_ref", "source_label", "source_when"], passages);
  await insertMany(client, "blot_casts", ["user_id", "divination_id", "vessel", "seed", "tea"], blotInserts);
  await insertMany(client, "playing_card_draws", ["user_id", "divination_id", "sort_order", "card_id", "card_name"], playing);
  await insertMany(client, "charm_casts", ["user_id", "divination_id", "sort_order", "set_name", "card_id", "charm_name", "x", "y", "face"], charmRows);
  await insertMany(client, "sign_notes", ["user_id", "divination_id", "note_type", "body", "happened_on"], signRows);
  await insertMany(client, "remoteview_trials", ["user_id", "divination_id", "options", "target_index", "impression", "sealed_at", "choice_index", "judged_at", "ideogram"], trialRows);
  await insertMany(client, "pendulum_answers", ["divination_id", "user_id", "swing_id", "shape", "angle", "swing_name", "meaning", "angle_tenths", "chosen_by", "motion_shape", "motion_angle"], answers);
  await insertMany(client, "journals", ["divination_id", "author", "content", "created_at", "kind"], journals);
  out.push(t.report);
}

/**
 * The readings of a tool with a name, oldest first. A file made before tea leaves and ink blots were split (2026-10-29) names a cup's tool as
 * "blots", and that cup comes in as "tea", so "blots" looks under both.
 */
function candidatesFor(byReading: Map<string, { id: number; created_at: string }[]>, tool: string, reading: string) {
  const name = reading.trim().toLowerCase();
  const tools = tool === "blots" ? ["blots", "tea"] : [tool];
  return tools.flatMap((t) => byReading.get(`${t}|${name}`) ?? []).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

// ── Predictions ──────────────────────────────────────────────────────────────────────────────────────

export async function importPredictions(client: PoolClient, userId: number, data: Row, out: SectionReport[]) {
  const t = new Tally("predictions", "Predictions and what you decided happened");
  const existing = (await client.query("SELECT divination_id, original_text, created_at FROM predictions WHERE user_id = $1", [userId])).rows as { divination_id: number; original_text: string; created_at: string }[];
  const readings = (await client.query("SELECT id, kind, created_at, COALESCE(NULLIF(title, ''), NULLIF(summary, ''), 'Reading') AS reading FROM divinations WHERE user_id = $1 ORDER BY created_at", [userId])).rows as { id: number; kind: string; created_at: string; reading: string }[];
  const have = new Set(existing.map((p) => `${p.divination_id}|${sec(p.created_at)}|${p.original_text.trim()}`));
  const byReading = new Map<string, { id: number; created_at: string }[]>();
  for (const r of readings) {
    const k = `${r.kind}|${r.reading.trim().toLowerCase()}`;
    (byReading.get(k) ?? byReading.set(k, []).get(k)!).push({ id: r.id, created_at: r.created_at });
  }
  const rows: unknown[][] = [];
  for (const raw of listOf(data.predictions, 3000)) {
    const p = cleanPrediction(raw);
    if (!p) { t.out(1, "A prediction that could not be read was left out."); continue; }
    const candidates = candidatesFor(byReading, p.tool, p.reading);
    // The reading it was about: the latest with that name made before the prediction was written.
    const before = candidates.filter((c) => new Date(c.created_at).getTime() <= new Date(p.written_at).getTime() + 86_400_000);
    const target = before[before.length - 1] ?? candidates[0];
    if (!target) { t.out(1, "A prediction whose reading is not in this account was left out (the reading has to be here first)."); continue; }
    const key = `${target.id}|${sec(p.written_at)}|${p.first_words.trim()}`;
    if (have.has(key)) { t.had(); continue; }
    have.add(key);
    t.added();
    rows.push([userId, target.id, p.first_words, p.current_words, p.written_at, p.look_back_on, p.outcome, p.outcome_note, p.resolved_at]);
  }
  await insertMany(client, "predictions", ["user_id", "divination_id", "original_text", "text", "created_at", "check_on", "outcome", "outcome_note", "resolved_at"], rows);
  out.push(t.report);
}

// ── First guesses ────────────────────────────────────────────────────────────────────────────────────

export async function importGuesses(client: PoolClient, userId: number, data: Row, out: SectionReport[]) {
  const t = new Tally("first_guesses", "What you sensed first, and how well it fitted");
  const haveReading = new Set(((await client.query("SELECT divination_id FROM reading_guesses WHERE user_id = $1", [userId])).rows as { divination_id: number }[]).map((r) => r.divination_id));
  const readings = (await client.query("SELECT id, kind, created_at, COALESCE(NULLIF(title, ''), NULLIF(summary, ''), 'Reading') AS reading FROM divinations WHERE user_id = $1 ORDER BY created_at", [userId])).rows as { id: number; kind: string; created_at: string; reading: string }[];
  const byReading = new Map<string, { id: number; created_at: string }[]>();
  for (const r of readings) {
    const k = `${r.kind}|${r.reading.trim().toLowerCase()}`;
    (byReading.get(k) ?? byReading.set(k, []).get(k)!).push({ id: r.id, created_at: r.created_at });
  }
  const rows: unknown[][] = [];
  for (const raw of listOf(data.first_guesses, 3000)) {
    const g = cleanGuessIn(raw);
    if (!g) { t.out(1, "A first guess that could not be read was left out."); continue; }
    const candidates = candidatesFor(byReading, g.tool, g.reading);
    // The reading it was about: the latest with that name made before the guess was sealed.
    const before = candidates.filter((c) => new Date(c.created_at).getTime() <= new Date(g.sealed_at).getTime() + 86_400_000);
    const target = before[before.length - 1] ?? candidates[0];
    if (!target) { t.out(1, "A first guess whose reading is not in this account was left out (the reading has to be here first)."); continue; }
    // One guess to a reading, and an existing one is never replaced.
    if (haveReading.has(target.id)) { t.had(); continue; }
    haveReading.add(target.id);
    t.added();
    rows.push([target.id, userId, g.guess, false, g.sealed_at, g.fit, g.fit_note, g.fit_at, g.confidence, g.logic]);
  }
  await insertMany(
    client,
    "reading_guesses",
    ["divination_id", "user_id", "guess", "skipped", "sealed_at", "fit", "fit_note", "fit_at", "confidence", "logic"],
    rows
  );
  out.push(t.report);
}

// ── Days ─────────────────────────────────────────────────────────────────────────────────────────────

export async function importDays(client: PoolClient, userId: number, data: Row, out: SectionReport[]) {
  const t = new Tally("days", "Your days (your writing for each day and the snapshots kept with it)");
  const haveDay = new Set(((await client.query("SELECT day::text AS day FROM day_entries WHERE user_id = $1", [userId])).rows as { day: string }[]).map((r) => r.day));
  const haveItem = new Set(((await client.query("SELECT day::text AS day, kind, title, snapshot FROM day_items WHERE user_id = $1 AND mode = 'snapshot'", [userId])).rows as { day: string; kind: string; title: string | null; snapshot: string }[]).map((r) => `${r.day}|${r.kind}|${r.title ?? ""}|${r.snapshot}`));
  const perDay = new Map<string, number>();
  for (const r of (await client.query("SELECT day::text AS day, COUNT(*)::int AS n FROM day_items WHERE user_id = $1 GROUP BY day", [userId])).rows as { day: string; n: number }[]) perDay.set(r.day, r.n);
  const lowest = Number(((await client.query("SELECT COALESCE(MIN(ref_id), 0)::int AS m FROM day_items WHERE user_id = $1", [userId])).rows[0] as { m: number }).m);
  let ref = Math.min(0, lowest);
  const entries: unknown[][] = [], items: unknown[][] = [];
  let linksLeftOut = 0;
  for (const raw of listOf(data.days, 5000)) {
    const d = cleanDay(raw);
    if (!d) { t.out(1, "A day that could not be read was left out."); continue; }
    linksLeftOut += d.links_left_out;
    if (d.writing) {
      if (haveDay.has(d.day)) t.had();
      else { haveDay.add(d.day); entries.push([userId, d.day, d.writing]); t.added(); }
    }
    for (const s of d.snapshots) {
      const key = `${d.day}|${s.kind}|${s.title ?? ""}|${s.snapshot}`;
      if (haveItem.has(key)) { t.had(); continue; }
      if ((perDay.get(d.day) ?? 0) >= MAX_ITEMS_PER_DAY) { t.out(1, `A day can hold ${MAX_ITEMS_PER_DAY} kept things, so the rest were left out.`); continue; }
      haveItem.add(key);
      perDay.set(d.day, (perDay.get(d.day) ?? 0) + 1);
      // The original is in another copy of the app, so the number points at nothing here: a negative one that cannot collide with a real row.
      items.push([userId, d.day, s.kind, "snapshot", --ref, s.title, s.snapshot, null, s.created_at]);
      t.added();
    }
  }
  if (linksLeftOut) t.out(linksLeftOut, "A live link to something in another copy of the app points at something else here, so it was left out (a snapshot comes in).");
  await insertMany(client, "day_entries", ["user_id", "day", "body"], entries);
  await insertMany(client, "day_items", ["user_id", "day", "kind", "mode", "ref_id", "title", "snapshot", "href", "created_at"], items);
  out.push(t.report);
}

// ── Own archetypes, concepts and links ───────────────────────────────────────────────────────────────

export async function importOwnArchetypes(client: PoolClient, userId: number, data: Row, out: SectionReport[]) {
  const ta = new Tally("own_archetypes", "Your own archetypes");
  const tc = new Tally("own_concepts", "Your own concepts");
  const tl = new Tally("own_links", "Your own links from pieces to archetypes and concepts");
  const haveA = new Map<string, number>();
  for (const a of (await client.query("SELECT id, name FROM user_archetypes WHERE user_id = $1", [userId])).rows as { id: number; name: string }[]) haveA.set(lower(a.name), a.id);
  const haveC = new Map<string, number>();
  for (const c of (await client.query("SELECT id, name FROM user_concepts WHERE user_id = $1", [userId])).rows as { id: number; name: string }[]) haveC.set(lower(c.name), c.id);
  const freshA = [];
  for (const raw of listOf(data.own_archetypes, 500)) {
    const a = cleanOwnArchetypeRow(raw);
    if (!a) { ta.out(1, "An archetype that could not be read was left out."); continue; }
    if (haveA.has(lower(a.name))) { ta.had(); continue; }
    if (haveA.size >= LIMITS.archetypes) { ta.out(1, `A person can have ${LIMITS.archetypes} archetypes of their own, so the rest were left out.`); continue; }
    haveA.set(lower(a.name), -1);
    freshA.push(a);
  }
  ta.added(freshA.length);
  const aIds = await reserveIds(client, "user_archetypes", freshA.length);
  await insertMany(client, "user_archetypes", ["id", "user_id", "name", "realm", "summary", "light", "shadow", "created_at", "updated_at"], freshA.map((a, i) => [aIds[i], userId, a.name, a.realm, a.summary, a.light, a.shadow, a.created_at, a.updated_at]));
  freshA.forEach((a, i) => haveA.set(lower(a.name), aIds[i]));

  const shared = new Map<string, number>();
  const slugByName = new Map(ARCHETYPES.map((a) => [lower(a.name), a.slug]));
  for (const r of (await client.query("SELECT id, slug FROM archetypes")).rows as { id: number; slug: string }[]) shared.set(r.slug, r.id);
  const freshC = [];
  for (const raw of listOf(data.own_concepts, 1000)) {
    const c = cleanOwnConceptRow(raw);
    if (!c) { tc.out(1, "A concept that could not be read was left out."); continue; }
    if (haveC.has(lower(c.name))) { tc.had(); continue; }
    if (haveC.size >= LIMITS.concepts) { tc.out(1, `A person can have ${LIMITS.concepts} concepts of their own, so the rest were left out.`); continue; }
    haveC.set(lower(c.name), -1);
    freshC.push(c);
  }
  tc.added(freshC.length);
  const cIds = await reserveIds(client, "user_concepts", freshC.length);
  // A concept's own realm (migration 101) is written only once the column is there; until then it takes its archetype's.
  const realms = Number((await client.query(
    "SELECT COUNT(*)::int AS n FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'user_concepts' AND column_name = 'realm'"
  )).rows[0]?.n) === 1;
  await insertMany(
    client, "user_concepts", ["id", "user_id", "name", "description", "shared_archetype_id", "user_archetype_id", "created_at", "updated_at", ...(realms ? ["realm"] : [])],
    freshC.map((c, i) => {
      const sharedId = c.under?.kind === "shared archetype" ? shared.get(slugByName.get(lower(c.under.name)) ?? "") ?? null : null;
      const ownId = c.under?.kind === "your archetype" ? haveA.get(lower(c.under.name)) ?? null : null;
      return [cIds[i], userId, c.name, c.description, sharedId, ownId && ownId > 0 ? ownId : null, c.created_at, c.updated_at, ...(realms ? [c.realm] : [])];
    })
  );
  freshC.forEach((c, i) => haveC.set(lower(c.name), cIds[i]));

  // Links: the piece by its id (or an oracle item by its name), the target by its name.
  const oracle = new Map<string, number>();
  for (const c of (await client.query("SELECT id, name FROM oracle_cards WHERE user_id = $1", [userId])).rows as { id: number; name: string }[]) if (!oracle.has(lower(c.name))) oracle.set(lower(c.name), c.id);
  const haveL = new Set(((await client.query("SELECT symbol_id, oracle_card_id, archetype_id, user_archetype_id, user_concept_id FROM user_symbol_links WHERE user_id = $1", [userId])).rows as Row[]).map((r) => `${r.symbol_id ?? ""}|${r.oracle_card_id ?? ""}|${r.archetype_id ?? ""}|${r.user_archetype_id ?? ""}|${r.user_concept_id ?? ""}`));
  const linkRows: unknown[][] = [];
  const { isKnownSymbolId } = await import("./symbol-ids");
  for (const raw of listOf(data.own_links, 3000)) {
    const from = (raw.from ?? {}) as Row, to = (raw.to ?? {}) as Row;
    const side = raw.side === "good side" ? "light" : raw.side === "hard side" ? "shadow" : "neutral";
    const fromId = typeof from.id === "string" ? from.id : "";
    const symbol = from.kind === "piece" && isKnownSymbolId(fromId) ? fromId : null;
    const oracleId = from.kind === "your oracle item" ? oracle.get(lower(fromId)) ?? null : null;
    const targetName = typeof to.name === "string" ? lower(to.name) : "";
    const sharedId = to.kind === "shared archetype" ? shared.get(slugByName.get(targetName) ?? "") ?? null : null;
    const ownA = to.kind === "your archetype" ? haveA.get(targetName) ?? null : null;
    const ownC = to.kind === "your concept" ? haveC.get(targetName) ?? null : null;
    if ((!symbol && !oracleId) || (!sharedId && !(ownA && ownA > 0) && !(ownC && ownC > 0))) { tl.out(1, "A link to a piece or a target this copy does not have was left out."); continue; }
    const key = `${symbol ?? ""}|${oracleId ?? ""}|${sharedId ?? ""}|${ownA && ownA > 0 ? ownA : ""}|${ownC && ownC > 0 ? ownC : ""}`;
    if (haveL.has(key)) { tl.had(); continue; }
    if (haveL.size >= LIMITS.links) { tl.out(1, `A person can have ${LIMITS.links} links of their own, so the rest were left out.`); continue; }
    haveL.add(key);
    tl.added();
    linkRows.push([userId, symbol, oracleId, sharedId, ownA && ownA > 0 ? ownA : null, ownC && ownC > 0 ? ownC : null, side]);
  }
  await insertMany(client, "user_symbol_links", ["user_id", "symbol_id", "oracle_card_id", "archetype_id", "user_archetype_id", "user_concept_id", "aspect"], linkRows);
  out.push(ta.report, tc.report, tl.report);
}

// ── Pictures: on oracle items and in the gallery ─────────────────────────────────────────────────────

/**
 * Adds the pictures an export carries: the picture of an oracle item (an upload or a drawing) where that item has none, and the gallery's pictures the
 * person does not have. Every picture is checked as an upload would be (its first bytes must be a JPEG, PNG or WebP, within the size limit) and counted
 * against the person's picture space and the gallery limit. Done last: a picture kept as a file is written before the transaction ends, and a check
 * (`apply: false`) writes no file at all.
 */
export async function importPictures(client: PoolClient, userId: number, data: Row, decks: DeckMaps, apply: boolean, out: SectionReport[]) {
  const ti = new Tally("art_items", "Pictures on your oracle items");
  const tg = new Tally("art_gallery", "Pictures in your gallery");
  const onDisk = artDir() !== null;
  const limit = maxPictureBytes();
  const budget = dbBudgetBytes();
  let used = 0;
  if (!onDisk) {
    used = Number(((await client.query(
      `SELECT (COALESCE((SELECT SUM(octet_length(data)) FROM oracle_card_art WHERE user_id = $1), 0) + COALESCE((SELECT SUM(octet_length(data)) FROM oracle_gallery WHERE user_id = $1), 0))::text AS used`, [userId]
    )).rows[0] as { used: string }).used);
  }
  /** Whether a picture of this size still fits; if it does it is counted. */
  const room = (bytes: number) => {
    if (onDisk) return true;
    if (used + bytes > budget) return false;
    used += bytes;
    return true;
  };
  const place = async (bytes: Buffer, mime: string) => (apply ? placeBytes(userId, bytes, mime) : { data: bytes, file_key: null as string | null });

  // On items. An item that already has a picture keeps it.
  const haveArt = new Set(((await client.query("SELECT card_id FROM oracle_card_art WHERE user_id = $1", [userId])).rows as { card_id: number }[]).map((r) => r.card_id));
  for (const rawDeck of listOf(data.oracle_decks, 200)) {
    const deckName = typeof rawDeck.name === "string" ? lower(rawDeck.name.replace(/\s+/g, " ").trim()) : "";
    const form = decks.decks.get(deckName)?.form ?? "cards";
    for (const rc of listOf(rawDeck.cards, 500)) {
      const pic = rc.picture && typeof rc.picture === "object" ? (rc.picture as Row) : null;
      if (!pic) continue;
      const cardName = typeof rc.name === "string" ? lower(rc.name.replace(/\s+/g, " ").trim()) : "";
      const cardId = decks.cards.get(`${deckName}|${cardName}`);
      if (!cardId) { ti.out(1, "A picture for an item that is not here was left out."); continue; }
      if (haveArt.has(cardId)) { ti.had(); continue; }
      const alt = cleanAlt(pic.description);
      const madeWith = cleanMadeWith(pic.made_with);
      if (pic.kind === "drawing") {
        const drawing = cleanDrawing(pic.drawing, form);
        if (!drawing.ok) { ti.out(1, "A drawing that could not be read was left out."); continue; }
        haveArt.add(cardId);
        ti.added();
        await client.query("INSERT INTO oracle_card_art (card_id, user_id, kind, strokes, alt, made_with) VALUES ($1, $2, 'drawing', $3, $4, $5)", [cardId, userId, JSON.stringify(drawing.drawing), alt, madeWith]);
      } else {
        const parsed = parseImageDataUrl(pic.image, limit);
        if (!parsed.ok) { ti.out(1, "A picture that could not be read (or was not in the file) was left out."); continue; }
        if (!room(parsed.bytes.length)) { ti.out(1, "Your picture space is full, so the rest of the pictures were left out."); continue; }
        haveArt.add(cardId);
        ti.added();
        const p = await place(parsed.bytes, parsed.mime);
        await client.query("INSERT INTO oracle_card_art (card_id, user_id, kind, mime, data, alt, made_with, file_key) VALUES ($1, $2, 'upload', $3, $4, $5, $6, $7)", [cardId, userId, parsed.mime, p.data, alt, madeWith, p.file_key]);
      }
    }
  }

  // In the gallery.
  const haveG = new Set(((await client.query("SELECT alt, prompt, created_at FROM oracle_gallery WHERE user_id = $1", [userId])).rows as { alt: string | null; prompt: string | null; created_at: string }[]).map((r) => `${sec(r.created_at)}|${r.alt ?? ""}|${r.prompt ?? ""}`));
  let count = haveG.size;
  for (const g of listOf(data.art_gallery, MAX_GALLERY_ITEMS * 2)) {
    const parsed = parseImageDataUrl(g.image, limit);
    const at = isoDate(g.added_at) ?? new Date().toISOString();
    const alt = cleanAlt(g.description);
    const prompt = typeof g.words_it_was_made_from === "string" ? g.words_it_was_made_from.slice(0, MAX_PROMPT_LENGTH) || null : null;
    if (!parsed.ok) { tg.out(1, "A picture that could not be read (or was not in the file) was left out."); continue; }
    const key = `${sec(at)}|${alt ?? ""}|${prompt ?? ""}`;
    if (haveG.has(key)) { tg.had(); continue; }
    if (count >= MAX_GALLERY_ITEMS) { tg.out(1, `The gallery holds ${MAX_GALLERY_ITEMS} pictures, so the rest were left out.`); continue; }
    if (!room(parsed.bytes.length)) { tg.out(1, "Your picture space is full, so the rest of the pictures were left out."); continue; }
    haveG.add(key);
    count++;
    tg.added();
    const p = await place(parsed.bytes, parsed.mime);
    await client.query(
      "INSERT INTO oracle_gallery (user_id, mime, data, file_key, alt, prompt, made_with, tags, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::text[], $9, $9)",
      [userId, parsed.mime, p.data, p.file_key, alt, prompt, cleanMadeWith(g.made_with), cleanTags(g.tags), at]
    );
  }
  out.push(ti.report, tg.report);
}

// ── Own names, picture styles, cloths ────────────────────────────────────────────────────────────────

export async function importNamesAndStyles(client: PoolClient, userId: number, data: Row, out: SectionReport[]) {
  const tn = new Tally("own_names", "Your own names for pieces (the sides of a knucklebone, ogham staves)");
  const ts = new Tally("picture_styles", "Your saved styles for pictures");
  const haveNames = new Set(((await client.query("SELECT piece_id FROM symbol_own_names WHERE user_id = $1", [userId])).rows as { piece_id: string }[]).map((r) => r.piece_id));
  const nameRows: unknown[][] = [];
  for (const raw of listOf(data.own_names, 200)) {
    const n = cleanNameRow(raw);
    if (!n) { tn.out(1, "A name that could not be read was left out."); continue; }
    if (haveNames.has(n.piece_id)) { tn.had(); continue; }
    haveNames.add(n.piece_id);
    tn.added();
    nameRows.push([userId, n.piece_id, n.name]);
  }
  await insertMany(client, "symbol_own_names", ["user_id", "piece_id", "name"], nameRows);
  const haveStyles = new Set(((await client.query("SELECT name FROM art_styles WHERE user_id = $1", [userId])).rows as { name: string }[]).map((r) => lower(r.name)));
  const styleRows: unknown[][] = [];
  for (const raw of listOf(data.picture_styles, 100)) {
    const s = cleanStyleRow(raw);
    if (!s) { ts.out(1, "A style that could not be read was left out."); continue; }
    if (haveStyles.has(lower(s.name))) { ts.had(); continue; }
    if (haveStyles.size >= MAX_ART_STYLES) { ts.out(1, `A person can keep ${MAX_ART_STYLES} styles, so the rest were left out.`); continue; }
    haveStyles.add(lower(s.name));
    ts.added();
    styleRows.push([userId, s.name, s.text, s.created_at]);
  }
  await insertMany(client, "art_styles", ["user_id", "name", "text", "created_at"], styleRows);
  out.push(tn.report, ts.report);
}

export async function importCloths(client: PoolClient, userId: number, data: Row, out: SectionReport[]) {
  const tc = new Tally("cloths", "Your cloths (with their zones)");
  const tp = new Tally("cloth_placements", "Where your items landed on your cloths");
  const clothIds = new Map<string, { id: number; name: string }>();
  for (const c of (await client.query("SELECT id, name FROM cloths WHERE user_id = $1", [userId])).rows as { id: number; name: string }[]) clothIds.set(lower(c.name), { id: c.id, name: c.name });
  const fresh = [];
  for (const raw of listOf(data.cloths, 100)) {
    const c = cleanClothRow(raw);
    if (!c) { tc.out(1, "A cloth that could not be read was left out."); continue; }
    if (clothIds.has(lower(c.name))) { tc.had(); continue; }
    if (clothIds.size >= MAX_CLOTHS) { tc.out(1, `A person can have ${MAX_CLOTHS} cloths, so the rest were left out.`); continue; }
    clothIds.set(lower(c.name), { id: -1, name: c.name });
    fresh.push(c);
  }
  tc.added(fresh.length);
  const ids = await reserveIds(client, "cloths", fresh.length);
  await insertMany(client, "cloths", ["id", "user_id", "name", "description"], fresh.map((c, i) => [ids[i], userId, c.name, c.description]));
  await insertMany(client, "cloth_zones", ["user_id", "cloth_id", "name", "note", "color", "geom", "sort_order"], fresh.flatMap((c, i) => c.zones.map((z, k) => [userId, ids[i], z.name, z.note, z.color, JSON.stringify(z.geom), k])));
  fresh.forEach((c, i) => clothIds.set(lower(c.name), { id: ids[i], name: c.name }));

  // Where items landed: the reading is found by its tool and its moment, because its number in the other copy means something else here.
  const readings = new Map<string, number>();
  for (const r of (await client.query("SELECT id, kind, created_at FROM divinations WHERE user_id = $1", [userId])).rows as { id: number; kind: string; created_at: string }[]) readings.set(`${r.kind}|${sec(r.created_at)}`, r.id);
  const haveP = new Set(((await client.query("SELECT DISTINCT divination_id FROM cloth_placements WHERE user_id = $1", [userId])).rows as { divination_id: number }[]).map((r) => r.divination_id));
  const rows: unknown[][] = [];
  for (const g of groupPlacements(data.cloth_placements)) {
    const reading = readings.get(`${g.tool}|${sec(g.made_at)}`);
    const cloth = clothIds.get(lower(g.cloth));
    if (!reading) { tp.out(g.rows.length, "Placements for a reading that is not in this account were left out."); continue; }
    if (haveP.has(reading)) { tp.had(g.rows.length); continue; }
    haveP.add(reading);
    g.rows.forEach((row, k) => {
      tp.added();
      rows.push([userId, reading, k, row.item, cloth && cloth.id > 0 ? cloth.id : null, cloth?.name ?? g.cloth, row.where_kind, row.zone, null, null, row.facing, row.simulated]);
    });
  }
  await insertMany(client, "cloth_placements", ["user_id", "divination_id", "item_index", "item_label", "cloth_id", "cloth_name", "where_kind", "zone_name", "x", "y", "facing", "simulated"], rows);
  out.push(tc.report, tp.report);
}

// ── Daily blind-target trials (migration 086) ─────────────────────────────────────────────────────────

/** Each judged daily trial once, by when it was started. Only judged ones are in an export, so nothing here can wait with a hidden target. */
export async function importDailyTrials(client: PoolClient, userId: number, data: Row, out: SectionReport[]) {
  const t = new Tally("blind_target_daily", "Your daily blind-target trials");
  const have = new Set(
    ((await client.query("SELECT created_at FROM remoteview_daily WHERE user_id = $1", [userId])).rows as { created_at: string | Date }[])
      .map((r) => new Date(r.created_at).toISOString())
  );
  const rows: unknown[][] = [];
  for (const raw of listOf(data.blind_target_daily, 5000)) {
    const d = cleanDailyTrialRow(raw);
    if (!d) { t.out(1, "A daily trial that could not be read was left out."); continue; }
    const key = new Date(d.started_at).toISOString();
    if (have.has(key)) { t.had(); continue; }
    have.add(key);
    t.added();
    rows.push([userId, d.target_index, d.choice_index, d.secret, d.seal, d.started_at, d.chosen_at]);
  }
  await insertMany(client, "remoteview_daily", ["user_id", "target_index", "choice_index", "nonce", "seal_hash", "created_at", "judged_at"], rows);
  out.push(t.report);
}

// ── Tarot practice (migration 092) ───────────────────────────────────────────────────────────────────

/** Each guessed practice card once: the same card at the same time is not added twice. */
export async function importTarotPractice(client: PoolClient, userId: number, data: Row, out: SectionReport[]) {
  const t = new Tally("tarot_practice", "Your tarot practice with a sealed card");
  const have = new Set(
    ((await client.query("SELECT card_id, created_at FROM tarot_practice WHERE user_id = $1", [userId])).rows as { card_id: string; created_at: string | Date }[])
      .map((r) => `${r.card_id}|${new Date(r.created_at).toISOString()}`)
  );
  const rows: unknown[][] = [];
  for (const raw of listOf(data.tarot_practice, 5000)) {
    const p = cleanPracticeRow(raw);
    if (!p) { t.out(1, "A practice card that could not be read was left out."); continue; }
    const key = `${p.card}|${new Date(p.at).toISOString()}`;
    if (have.has(key)) { t.had(); continue; }
    have.add(key);
    t.added();
    rows.push([userId, p.card, p.sensed_suit, p.words, p.at, p.at]);
  }
  await insertMany(client, "tarot_practice", ["user_id", "card_id", "guess_suit", "guess_words", "created_at", "guessed_at"], rows);
  out.push(t.report);
}
