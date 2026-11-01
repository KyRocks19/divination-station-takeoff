// The header's search over what lives in the database: the shared concepts, the person's own readings, journal entries,
// day pages, oracle cards, meanings (for every tool) with the fields on oracle items, predictions, what was sensed first, own archetypes and
// concepts, and the forum's posts. Earlier versions of a meaning and the forum's comments are searched only when the person ticks them.
// Every query of the person's writing is scoped by their user id. The rules (what matches, how it ranks, the words
// shown) are in lib/search-core.ts.

import { query, queryOne } from "./db";
import { conceptQuery, showsSensitive } from "./concept-visibility";
import { forumViewer } from "./forum-circles";
import { listScope } from "./forum-circles-core";
import { DIVINATION_KIND_LABELS, divinationPath, type DivinationKind } from "./divination-kinds";
import { swingName } from "./pendulum-swings";
import {
  GROUP_LABELS,
  PER_GROUP,
  dayFromQuery,
  dayFromWords,
  likePatterns,
  meaningPiece,
  orderGroups,
  rankEntries,
  scoreText,
  searchStatic,
  snippetAround,
  stripMarkdown,
  type Entry,
  type SearchGroup,
  type SearchItem,
} from "./search-core";
import type { SearchOption } from "./search-shared";

/**
 * How the words of a query are matched in SQL. With the `unaccent` extension (migration 072) the text and the words are
 * both taken without accents, so "hekate" finds "Hékate" and "Hékate" finds "Hekate". Without it (a copy that has not
 * run the migration, or a host that does not allow it) matching is the plain ILIKE it was before: case is ignored and
 * accents must match. Ranking and the words shown always ignore accents, in code (lib/search-core.ts).
 */
interface Matcher {
  patterns: string[];
  fold: boolean;
}

/** Whether the unaccent extension is installed here. Remembered, so a search does not ask each time. */
let unaccentSeen: { at: number; ok: boolean } | null = null;
async function hasUnaccent(): Promise<boolean> {
  const now = Date.now();
  // Found stays found for ten minutes; not found is looked at again after a minute, so running the migration takes effect soon.
  if (unaccentSeen && now - unaccentSeen.at < (unaccentSeen.ok ? 10 * 60_000 : 60_000)) return unaccentSeen.ok;
  let ok = false;
  try {
    ok = !!(await queryOne("SELECT 1 AS x FROM pg_extension WHERE extname = 'unaccent'"));
  } catch (err) {
    console.error("[search] could not look for the unaccent extension; matching with accents", err);
  }
  unaccentSeen = { at: now, ok };
  return ok;
}

async function matcher(q: string): Promise<Matcher> {
  const fold = await hasUnaccent();
  return { patterns: likePatterns(q, fold), fold };
}

/** `expr ILIKE ALL ($n::text[])`, with the accents taken off `expr` when the words had theirs taken off. */
function like(m: Matcher, expr: string, param: string): string {
  return `${m.fold ? `unaccent(${expr})` : expr} ILIKE ALL (${param}::text[])`;
}

/** Rows read for ranking in code before the best PER_GROUP are kept. */
const CANDIDATES = 40;

// The concepts are shared and change only when they are seeded, so they are read once and kept for ten minutes. Ranking
// them in code ranks them exactly like the shared things kept in code.
// A concept marked hidden is never searched; one marked sensitive is searched only for a person who turned sensitive meanings on. The older wording
// of a reworded concept finds it (a keyword, ranked below the new wording) but is never shown.
let conceptCache: { at: number; entries: (Entry & { sensitive: boolean })[] } | null = null;
const CONCEPT_TTL_MS = 10 * 60 * 1000;

async function conceptEntries(showSensitive: boolean): Promise<Entry[]> {
  if (!conceptCache || Date.now() - conceptCache.at >= CONCEPT_TTL_MS) {
    const rows = await conceptQuery<{ name: string; display_name: string; aliases: string[]; sensitivity: string | null }>(
      "SELECT c.name, c.display_name, {aliases} AS aliases, {sensitivity} AS sensitivity FROM concepts c WHERE {visible} ORDER BY c.display_name ASC",
      [],
      true
    );
    conceptCache = {
      at: Date.now(),
      entries: rows.map((r) => ({
        id: `concept-${r.name}`,
        label: r.display_name,
        href: `/encyclopedia/${encodeURIComponent(r.name)}`,
        keywords: r.aliases?.length ? r.aliases : undefined,
        sensitive: r.sensitivity === "reveal",
      })),
    };
  }
  return conceptCache.entries.filter((e) => showSensitive || !e.sensitive);
}

/** The name a reading goes by in a list: its title, else its question, else what came up. */
function readingName(r: { title: string | null; question: string | null; summary: string | null }): string {
  const name = (r.title || r.question || r.summary || "").replace(/\s+/g, " ").trim();
  if (!name) return "Untitled reading";
  return name.length > 90 ? name.slice(0, 89) + "…" : name;
}

function kindLabel(kind: string | null): string {
  return (kind && DIVINATION_KIND_LABELS[kind as DivinationKind]) || "Tarot";
}

/**
 * Sorts rows whose label matched the query to the front (best first), keeping the database's newest-first order among
 * equals, then keeps PER_GROUP.
 */
function bestFirst<T>(rows: T[], label: (r: T) => string, q: string): { rows: T[]; more: boolean } {
  const ranked = rows
    .map((r, i) => ({ r, i, s: scoreText(label(r), q) ?? 0 }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.r);
  return { rows: ranked.slice(0, PER_GROUP), more: rows.length > PER_GROUP };
}

async function searchReadings(userId: number, q: string, m: Matcher): Promise<SearchGroup> {
  const rows = await query<{
    id: number;
    kind: string;
    title: string | null;
    question: string | null;
    summary: string | null;
    reading_id: number | null;
    created_at: string;
  }>(
    `SELECT id, kind, title, question, summary, reading_id, created_at
     FROM divinations
     WHERE user_id = $1 AND ${like(m, "concat_ws(' ', title, question, summary)", "$2")}
     ORDER BY created_at DESC
     LIMIT ${CANDIDATES + 1}`,
    [userId, m.patterns]
  );
  // The text of a note of a sign or dream (migration 085) is longer than the line kept as its summary, so it is searched in its own query.
  const bodies = new Map<number, string>();
  const notes = await query<{ id: number; kind: string; title: string | null; question: string | null; summary: string | null; reading_id: number | null; created_at: string; body: string }>(
    `SELECT d.id, d.kind, d.title, d.question, d.summary, d.reading_id, d.created_at, n.body
     FROM sign_notes n JOIN divinations d ON d.id = n.divination_id
     WHERE n.user_id = $1 AND d.user_id = $1 AND ${like(m, "n.body", "$2")}
     ORDER BY d.created_at DESC LIMIT ${CANDIDATES + 1}`,
    [userId, m.patterns]
  );
  for (const n of notes) {
    bodies.set(n.id, n.body);
    if (!rows.some((r) => r.id === n.id)) rows.push(n);
  }
  const { rows: kept, more } = bestFirst(rows, readingName, q);
  const items: SearchItem[] = kept.map((r) => {
    const label = readingName(r);
    const item: SearchItem = {
      id: `reading-${r.id}`,
      label,
      href: divinationPath(r.kind as DivinationKind, r.id, r.reading_id),
      note: kindLabel(r.kind),
      when: new Date(r.created_at).toISOString(),
    };
    // Show where the words were found when they are not in the name.
    if (scoreText(label, q) === null) {
      const other = [r.question, r.summary, bodies.get(r.id)].find((t) => t && snippetAround(t, q));
      if (other) item.snippet = snippetAround(other, q) ?? undefined;
    }
    return item;
  });
  return { id: "readings", label: GROUP_LABELS.readings, items, more };
}

async function searchJournals(userId: number, q: string, m: Matcher): Promise<SearchGroup> {
  // Only what the person wrote (author 'user'), on readings that are theirs: a tarot reading (reading_id) or a reading of
  // any other tool (divination_id).
  const rows = await query<{
    id: number;
    content: string;
    reading_id: number | null;
    divination_id: number | null;
    created_at: string;
    kind: string | null;
    d_reading_id: number | null;
    title: string | null;
    question: string | null;
    summary: string | null;
  }>(
    `SELECT j.id, j.content, j.reading_id, j.divination_id, j.created_at,
            d.kind, d.reading_id AS d_reading_id,
            COALESCE(r.title, d.title) AS title, COALESCE(r.question, d.question) AS question, d.summary
     FROM journals j
     LEFT JOIN readings r ON r.id = j.reading_id
     LEFT JOIN divinations d ON d.id = j.divination_id
     WHERE COALESCE(r.user_id, d.user_id) = $1
       AND j.author = 'user'
       AND ${like(m, "j.content", "$2")}
     ORDER BY j.created_at DESC
     LIMIT ${PER_GROUP + 1}`,
    [userId, m.patterns]
  );
  const items: SearchItem[] = rows.slice(0, PER_GROUP).map((r) => ({
    id: `journal-${r.id}`,
    label: readingName(r),
    href: r.reading_id
      ? `/readings/${r.reading_id}`
      : divinationPath((r.kind ?? "tarot") as DivinationKind, r.divination_id ?? 0, r.d_reading_id),
    note: `Journal on a ${kindLabel(r.kind)} reading`,
    snippet: snippetAround(r.content, q) ?? undefined,
    when: new Date(r.created_at).toISOString(),
  }));
  return { id: "journals", label: GROUP_LABELS.journals, items, more: rows.length > PER_GROUP };
}

async function searchDays(userId: number, q: string, m: Matcher, today: string): Promise<SearchGroup> {
  const rows = await query<{ day: string; body: string }>(
    `SELECT day::text AS day, body
     FROM day_entries
     WHERE user_id = $1 AND ${like(m, "body", "$2")}
     ORDER BY day DESC
     LIMIT ${PER_GROUP + 1}`,
    [userId, m.patterns]
  );
  const items: SearchItem[] = rows.slice(0, PER_GROUP).map((r) => ({
    id: `day-${r.day}`,
    label: r.day,
    day: r.day,
    href: `/days/${r.day}`,
    snippet: snippetAround(stripMarkdown(r.body), q) ?? undefined,
  }));
  let more = rows.length > PER_GROUP;
  // A date typed in full, or in words ("yesterday", "3 october"), opens that day's page, written on or not.
  const asked = dayFromQuery(q) ?? dayFromWords(q, today);
  if (asked && !items.some((i) => i.day === asked)) {
    items.unshift({ id: `day-${asked}`, label: asked, day: asked, href: `/days/${asked}`, note: "Day page" });
    if (items.length > PER_GROUP) {
      items.pop();
      more = true;
    }
  }
  return { id: "days", label: GROUP_LABELS.days, items, more };
}

async function searchOracle(userId: number, q: string, m: Matcher): Promise<SearchGroup> {
  const rows = await query<{ id: number; name: string; deck_name: string }>(
    `SELECT c.id, c.name, d.name AS deck_name
     FROM oracle_cards c JOIN oracle_decks d ON d.id = c.deck_id
     WHERE c.user_id = $1 AND d.user_id = $1 AND ${like(m, "c.name", "$2")}
     ORDER BY c.name ASC
     LIMIT ${CANDIDATES + 1}`,
    [userId, m.patterns]
  );
  const { items, more } = rankEntries(
    rows.map((r) => ({ id: `oracle-${r.id}`, label: r.name, href: `/oracle/cards/${r.id}`, note: r.deck_name })),
    q
  );
  return { id: "oracle", label: GROUP_LABELS.oracle, items, more: more || rows.length > CANDIDATES };
}

/** The first of the texts that holds a word of the query, as the words around it. */
function snippetFrom(texts: (string | null | undefined)[], q: string): SearchItem["snippet"] {
  for (const t of texts) {
    if (!t) continue;
    const s = snippetAround(stripMarkdown(t), q);
    if (s) return s;
  }
  return undefined;
}

interface MeaningHit {
  id: string;
  label: string;
  note: string;
  href: string;
  texts: (string | null)[];
  when: number;
}

/** Name matches first, then the most recently changed. */
function rankHits(hits: MeaningHit[], q: string): MeaningHit[] {
  return hits
    .map((h) => ({ h, s: scoreText(h.label, q) ?? 0 }))
    .sort((a, b) => b.s - a.s || b.h.when - a.h.when)
    .map((x) => x.h);
}

/**
 * Every meaning the person wrote: for a tarot card, rune, ogham stave, die or coin face, or a whole suit or number
 * (card_customizations), for a pendulum swing, and for an item in their own oracle sets, with the fields they gave it
 * (name and value, for example "song: Blackbird"). Only the current wording is searched here; earlier versions are
 * kept as history and are searched only when the person asks (searchEarlier).
 */
async function searchMeanings(userId: number, q: string, m: Matcher): Promise<SearchGroup> {
  const [custom, swings, oracle, ownNamed, oracleFields] = await Promise.all([
    query<{
      card_id: string;
      upright_keywords: string | null;
      reversed_keywords: string | null;
      upright_description: string | null;
      reversed_description: string | null;
      updated_at: string;
    }>(
      `SELECT card_id, upright_keywords, reversed_keywords, upright_description, reversed_description, updated_at
       FROM card_customizations
       WHERE user_id = $1
         AND ${like(m, "concat_ws(' ', upright_keywords, reversed_keywords, upright_description, reversed_description)", "$2")}
       ORDER BY updated_at DESC
       LIMIT 200`,
      [userId, m.patterns]
    ),
    query<{ id: number; shape: string; angle: number | null; name: string | null; builtin: number; meaning: string | null; updated_at: string }>(
      `SELECT id, shape, angle, name, builtin, meaning, updated_at
       FROM pendulum_swings
       WHERE user_id = $1 AND ${like(m, "concat_ws(' ', name, meaning)", "$2")}
       ORDER BY updated_at DESC
       LIMIT ${CANDIDATES + 1}`,
      [userId, m.patterns]
    ),
    query<{ id: number; card_id: number; label: string | null; content: string; updated_at: string; name: string; deck_name: string }>(
      `SELECT m.id, m.card_id, m.label, m.content, m.updated_at, c.name, d.name AS deck_name
       FROM oracle_card_meanings m
       JOIN oracle_cards c ON c.id = m.card_id
       JOIN oracle_decks d ON d.id = c.deck_id
       WHERE m.user_id = $1 AND c.user_id = $1 AND d.user_id = $1
         AND ${like(m, "concat_ws(' ', m.label, m.content)", "$2")}
       ORDER BY m.updated_at DESC
       LIMIT ${CANDIDATES + 1}`,
      [userId, m.patterns]
    ),
    // The person's own names for pieces (migration 076).
    query<{ piece_id: string; name: string; updated_at: string }>(
      `SELECT piece_id, name, updated_at FROM symbol_own_names
       WHERE user_id = $1 AND ${like(m, "name", "$2")}
       ORDER BY updated_at DESC
       LIMIT 20`,
      [userId, m.patterns]
    ),
    // The fields the person named themselves on an item of their oracle sets ("song", "season") and the values they gave.
    query<{ card_id: number; name: string; value: string | null; updated_at: string; card_name: string; deck_name: string }>(
      `SELECT f.card_id, f.name, f.value, f.updated_at, c.name AS card_name, d.name AS deck_name
       FROM oracle_card_fields f
       JOIN oracle_cards c ON c.id = f.card_id
       JOIN oracle_decks d ON d.id = c.deck_id
       WHERE f.user_id = $1 AND c.user_id = $1 AND d.user_id = $1
         AND ${like(m, "concat_ws(' ', f.name, f.value)", "$2")}
       ORDER BY f.updated_at DESC
       LIMIT ${CANDIDATES + 1}`,
      [userId, m.patterns]
    ),
  ]);

  const hits: MeaningHit[] = [];
  for (const r of ownNamed) {
    const piece = meaningPiece(r.piece_id);
    if (!piece) continue;
    hits.push({ id: `meaning-name-${r.piece_id}`, label: r.name, note: `${piece.label} · your name for it`, href: piece.href, texts: [r.name], when: new Date(r.updated_at).getTime() });
  }
  for (const r of custom) {
    const piece = meaningPiece(r.card_id);
    if (!piece) continue;
    hits.push({
      id: `meaning-${r.card_id}`,
      ...piece,
      texts: [r.upright_keywords, r.upright_description, r.reversed_keywords, r.reversed_description],
      when: new Date(r.updated_at).getTime(),
    });
  }
  for (const r of swings) {
    hits.push({
      id: `meaning-swing-${r.id}`,
      label: swingName(r),
      note: "Pendulum swing",
      href: "/pendulum/swings",
      texts: [r.meaning],
      when: new Date(r.updated_at).getTime(),
    });
  }
  // One result for an oracle item however many meanings of it match; the newest meaning is the one shown.
  const seen = new Set<number>();
  for (const r of oracle) {
    if (seen.has(r.card_id)) continue;
    seen.add(r.card_id);
    hits.push({
      id: `meaning-oracle-${r.card_id}`,
      label: r.name,
      note: `${r.deck_name} · oracle item`,
      href: `/oracle/cards/${r.card_id}`,
      texts: [r.content, r.label],
      when: new Date(r.updated_at).getTime(),
    });
  }
  // An item whose meaning already matched is not listed a second time for its fields.
  for (const r of oracleFields) {
    if (seen.has(r.card_id)) continue;
    seen.add(r.card_id);
    hits.push({
      id: `meaning-oracle-${r.card_id}`,
      label: r.card_name,
      note: `${r.deck_name} · oracle item`,
      href: `/oracle/cards/${r.card_id}`,
      texts: [r.value, r.name],
      when: new Date(r.updated_at).getTime(),
    });
  }

  const ranked = rankHits(hits, q);
  const items: SearchItem[] = ranked.slice(0, PER_GROUP).map((h) => ({
    id: h.id,
    label: h.label,
    href: h.href,
    note: h.note,
    snippet: snippetFrom(h.texts, q),
    when: new Date(h.when).toISOString(),
  }));
  return { id: "meanings", label: GROUP_LABELS.meanings, items, more: ranked.length > PER_GROUP };
}

/**
 * Wording the person has replaced (Q7, only when they ask): the saved earlier versions of a meaning for a tarot card,
 * rune, ogham stave, die or coin face or a whole suit or number (card_meaning_revisions), of an item in their oracle sets
 * and of a pendulum swing. A version that is the same as the present wording is left out, because the "Your meanings"
 * group already finds that. The result opens the piece's page, and says when the version was written.
 */
async function searchEarlier(userId: number, q: string, m: Matcher): Promise<SearchGroup> {
  const [cards, oracle, swings] = await Promise.all([
    query<{
      id: number;
      card_id: string;
      upright_keywords: string | null;
      reversed_keywords: string | null;
      upright_description: string | null;
      reversed_description: string | null;
      created_at: string;
    }>(
      `SELECT r.id, r.card_id, r.upright_keywords, r.reversed_keywords, r.upright_description, r.reversed_description, r.created_at
       FROM card_meaning_revisions r
       WHERE r.user_id = $1
         AND ${like(m, "concat_ws(' ', r.upright_keywords, r.reversed_keywords, r.upright_description, r.reversed_description)", "$2")}
         AND NOT EXISTS (
           SELECT 1 FROM card_customizations c
           WHERE c.user_id = r.user_id AND c.card_id = r.card_id
             AND c.upright_keywords IS NOT DISTINCT FROM r.upright_keywords
             AND c.reversed_keywords IS NOT DISTINCT FROM r.reversed_keywords
             AND c.upright_description IS NOT DISTINCT FROM r.upright_description
             AND c.reversed_description IS NOT DISTINCT FROM r.reversed_description
         )
       ORDER BY r.created_at DESC
       LIMIT 200`,
      [userId, m.patterns]
    ),
    query<{ id: number; card_id: number; label: string | null; content: string; created_at: string; name: string; deck_name: string }>(
      `SELECT r.id, m.card_id, r.label, r.content, r.created_at, c.name, d.name AS deck_name
       FROM oracle_card_meaning_revisions r
       JOIN oracle_card_meanings m ON m.id = r.meaning_id
       JOIN oracle_cards c ON c.id = m.card_id
       JOIN oracle_decks d ON d.id = c.deck_id
       WHERE r.user_id = $1 AND m.user_id = $1 AND c.user_id = $1 AND d.user_id = $1
         AND ${like(m, "concat_ws(' ', r.label, r.content)", "$2")}
         AND NOT (r.content IS NOT DISTINCT FROM m.content AND r.label IS NOT DISTINCT FROM m.label)
       ORDER BY r.created_at DESC
       LIMIT ${CANDIDATES + 1}`,
      [userId, m.patterns]
    ),
    query<{ id: number; swing_id: number; content: string; created_at: string; shape: string; angle: number | null; name: string | null; builtin: number; meaning: string | null }>(
      `SELECT r.id, r.swing_id, r.content, r.created_at, s.shape, s.angle, s.name, s.builtin, s.meaning
       FROM pendulum_swing_revisions r
       JOIN pendulum_swings s ON s.id = r.swing_id
       WHERE r.user_id = $1 AND s.user_id = $1 AND ${like(m, "r.content", "$2")}
         AND r.content IS DISTINCT FROM s.meaning
       ORDER BY r.created_at DESC
       LIMIT ${CANDIDATES + 1}`,
      [userId, m.patterns]
    ),
  ]);

  const hits: MeaningHit[] = [];
  for (const r of cards) {
    const piece = meaningPiece(r.card_id);
    if (!piece) continue;
    hits.push({
      id: `earlier-card-${r.id}`,
      label: piece.label,
      note: `${piece.note} · earlier version`,
      href: piece.href,
      texts: [r.upright_keywords, r.upright_description, r.reversed_keywords, r.reversed_description],
      when: new Date(r.created_at).getTime(),
    });
  }
  for (const r of oracle) {
    hits.push({
      id: `earlier-oracle-${r.id}`,
      label: r.name,
      note: `${r.deck_name} · oracle item · earlier version`,
      href: `/oracle/cards/${r.card_id}`,
      texts: [r.content, r.label],
      when: new Date(r.created_at).getTime(),
    });
  }
  for (const r of swings) {
    hits.push({
      id: `earlier-swing-${r.id}`,
      label: swingName(r),
      note: "Pendulum swing · earlier version",
      href: "/pendulum/swings",
      texts: [r.content],
      when: new Date(r.created_at).getTime(),
    });
  }
  const ranked = rankHits(hits, q);
  const items: SearchItem[] = ranked.slice(0, PER_GROUP).map((h) => ({
    id: h.id,
    label: h.label,
    href: h.href,
    note: h.note,
    snippet: snippetFrom(h.texts, q),
    when: new Date(h.when).toISOString(),
  }));
  return { id: "earlier", label: GROUP_LABELS.earlier, items, more: ranked.length > PER_GROUP };
}

async function searchPredictions(userId: number, q: string, m: Matcher): Promise<SearchGroup> {
  const rows = await query<{
    id: number;
    text: string;
    original_text: string;
    outcome_note: string | null;
    created_at: string;
    kind: string;
    divination_id: number;
    reading_id: number | null;
  }>(
    `SELECT p.id, p.text, p.original_text, p.outcome_note, p.created_at, d.kind, d.id AS divination_id, d.reading_id
     FROM predictions p
     JOIN divinations d ON d.id = p.divination_id
     WHERE p.user_id = $1 AND d.user_id = $1
       AND ${like(m, "concat_ws(' ', p.text, p.original_text, p.outcome_note)", "$2")}
     ORDER BY p.created_at DESC
     LIMIT ${PER_GROUP + 1}`,
    [userId, m.patterns]
  );
  const items: SearchItem[] = rows.slice(0, PER_GROUP).map((r) => {
    const label = r.text.replace(/\s+/g, " ").trim();
    const short = label.length > 90 ? label.slice(0, 89) + "…" : label;
    return {
      id: `prediction-${r.id}`,
      label: short,
      href: divinationPath(r.kind as DivinationKind, r.divination_id, r.reading_id),
      note: `Prediction on a ${kindLabel(r.kind)} reading`,
      // Shown when the words were found in the sealed first wording or the note on the outcome, not the current text.
      snippet: scoreText(short, q) === null ? snippetFrom([r.original_text, r.outcome_note], q) : undefined,
      when: new Date(r.created_at).toISOString(),
    };
  });
  return { id: "predictions", label: GROUP_LABELS.predictions, items, more: rows.length > PER_GROUP };
}

/** "Write what you sense first" (migration 090): the person's own sealed guesses and their notes on how well each fitted. Never set-aside ones. */
async function searchGuesses(userId: number, q: string, m: Matcher): Promise<SearchGroup> {
  const rows = await query<{ guess: string; fit_note: string | null; sealed_at: string; kind: string; divination_id: number; reading_id: number | null }>(
    `SELECT g.guess, g.fit_note, g.sealed_at, d.kind, d.id AS divination_id, d.reading_id
     FROM reading_guesses g
     JOIN divinations d ON d.id = g.divination_id
     WHERE g.user_id = $1 AND d.user_id = $1 AND NOT g.skipped
       AND ${like(m, "concat_ws(' ', g.guess, g.fit_note)", "$2")}
     ORDER BY g.sealed_at DESC
     LIMIT ${PER_GROUP + 1}`,
    [userId, m.patterns]
  );
  const items: SearchItem[] = rows.slice(0, PER_GROUP).map((r) => {
    const label = r.guess.replace(/\s+/g, " ").trim();
    const short = label.length > 90 ? label.slice(0, 89) + "…" : label;
    return {
      id: `guess-${r.divination_id}`,
      label: short,
      href: divinationPath(r.kind as DivinationKind, r.divination_id, r.reading_id),
      note: `Sensed first on a ${kindLabel(r.kind)} reading`,
      // Shown when the words were found in the note on how well it fitted, or past the shortened label.
      snippet: scoreText(short, q) === null ? snippetFrom([r.guess, r.fit_note], q) : undefined,
      when: new Date(r.sealed_at).toISOString(),
    };
  });
  return { id: "guesses", label: GROUP_LABELS.guesses, items, more: rows.length > PER_GROUP };
}

/** The person's own archetypes and concepts (migration 060): private, found by name or by what they wrote about them. */
async function searchYours(userId: number, q: string, m: Matcher): Promise<SearchGroup> {
  const [archetypes, concepts] = await Promise.all([
    query<{ id: number; name: string; realm: string | null; summary: string; light: string; shadow: string; updated_at: string }>(
      `SELECT id, name, realm, summary, light, shadow, updated_at
       FROM user_archetypes
       WHERE user_id = $1 AND ${like(m, "concat_ws(' ', name, realm, summary, light, shadow)", "$2")}
       ORDER BY updated_at DESC
       LIMIT ${CANDIDATES + 1}`,
      [userId, m.patterns]
    ),
    query<{ id: number; name: string; description: string; realm: string | null; updated_at: string }>(
      `SELECT id, name, description, realm, updated_at
       FROM user_concepts
       WHERE user_id = $1 AND ${like(m, "concat_ws(' ', name, description, realm)", "$2")}
       ORDER BY updated_at DESC
       LIMIT ${CANDIDATES + 1}`,
      [userId, m.patterns]
    ),
  ]);
  const hits: MeaningHit[] = [
    ...archetypes.map((r) => ({
      id: `own-archetype-${r.id}`,
      label: r.name,
      note: "Your archetype",
      href: "/archetypes#yours-h",
      texts: [r.summary, r.light, r.shadow, r.realm],
      when: new Date(r.updated_at).getTime(),
    })),
    ...concepts.map((r) => ({
      id: `own-concept-${r.id}`,
      label: r.name,
      note: "Your concept",
      href: "/archetypes#yours-h",
      texts: [r.description, r.realm],
      when: new Date(r.updated_at).getTime(),
    })),
  ];
  const ranked = rankHits(hits, q);
  const items: SearchItem[] = ranked.slice(0, PER_GROUP).map((h) => ({
    id: h.id,
    label: h.label,
    href: h.href,
    note: h.note,
    snippet: scoreText(h.label, q) === null ? snippetFrom(h.texts, q) : undefined,
  }));
  return { id: "yours", label: GROUP_LABELS.yours, items, more: ranked.length > PER_GROUP };
}

/**
 * The person's cloths (name and description) and the zones they drew on them (name and note), migration 077. A zone is found under its cloth: the result
 * opens the cloth's page. Only their own words are searched; the app gives no cloth or zone any words of its own.
 */
async function searchCloths(userId: number, q: string, m: Matcher): Promise<SearchGroup> {
  const [cloths, zones] = await Promise.all([
    query<{ id: number; name: string; description: string | null; updated_at: string }>(
      `SELECT id, name, description, updated_at FROM cloths
       WHERE user_id = $1 AND ${like(m, "concat_ws(' ', name, description)", "$2")}
       ORDER BY updated_at DESC LIMIT ${CANDIDATES + 1}`,
      [userId, m.patterns]
    ),
    query<{ cloth_id: number; cloth_name: string; name: string; note: string | null; updated_at: string }>(
      `SELECT z.cloth_id, c.name AS cloth_name, z.name, z.note, c.updated_at
       FROM cloth_zones z JOIN cloths c ON c.id = z.cloth_id
       WHERE z.user_id = $1 AND c.user_id = $1 AND ${like(m, "concat_ws(' ', z.name, z.note)", "$2")}
       ORDER BY c.updated_at DESC, z.sort_order LIMIT ${CANDIDATES + 1}`,
      [userId, m.patterns]
    ),
  ]);
  const hits: MeaningHit[] = [
    ...cloths.map((r) => ({
      id: `cloth-${r.id}`,
      label: r.name,
      note: "Your cloth",
      href: `/lots/cloths/${r.id}`,
      texts: [r.description],
      when: new Date(r.updated_at).getTime(),
    })),
    ...zones.map((r) => ({
      id: `cloth-zone-${r.cloth_id}-${r.name}`,
      label: r.name,
      note: `Zone on ${r.cloth_name}`,
      href: `/lots/cloths/${r.cloth_id}`,
      texts: [r.note],
      when: new Date(r.updated_at).getTime(),
    })),
  ];
  const ranked = rankHits(hits, q);
  const items: SearchItem[] = ranked.slice(0, PER_GROUP).map((h) => ({
    id: h.id,
    label: h.label,
    href: h.href,
    note: h.note,
    snippet: scoreText(h.label, q) === null ? snippetFrom(h.texts, q) : undefined,
  }));
  return { id: "cloths", label: GROUP_LABELS.cloths, items, more: ranked.length > PER_GROUP };
}

/**
 * Posts in the forum that the person can read: their circle's and their own (migration 074). A post that has been reported enough times to be hidden
 * (hidden_at, migration 054) is left out for everyone, its author and the owner too: the search is not a way round it.
 * Comments are searched only when the person asks (searchComments).
 */
async function searchForum(userId: number, isAdmin: boolean, q: string, m: Matcher): Promise<SearchGroup> {
  const params: unknown[] = [m.patterns];
  const scope = listScope(await forumViewer(userId, isAdmin), "fp", params);
  const rows = await query<{ id: number; title: string; body: string; created_at: string; author: string }>(
    `SELECT fp.id, fp.title, fp.body, fp.created_at, COALESCE(u.display_name, u.username) AS author
     FROM forum_posts fp
     JOIN users u ON u.id = fp.user_id
     WHERE fp.hidden_at IS NULL AND ${like(m, "concat_ws(' ', fp.title, fp.body)", "$1")}${scope ? ` AND ${scope}` : ""}
     ORDER BY fp.created_at DESC
     LIMIT ${CANDIDATES + 1}`,
    params
  );
  const { rows: kept, more } = bestFirst(rows, (r) => r.title, q);
  const items: SearchItem[] = kept.map((r) => ({
    id: `forum-${r.id}`,
    label: r.title,
    href: `/forum/${r.id}`,
    note: `Forum · by ${r.author}`,
    snippet: scoreText(r.title, q) === null ? (snippetAround(stripMarkdown(r.body), q) ?? undefined) : undefined,
    when: new Date(r.created_at).toISOString(),
  }));
  return { id: "forum", label: GROUP_LABELS.forum, items, more };
}

/**
 * Comments on the forum posts the person can read (Q7, only when they ask): their circle's posts and their own, by the same
 * rule as the posts (listScope). A hidden post, or a hidden comment, is left out for everyone. The result opens the post.
 * These are other people's words, so the group is last, says who wrote the comment, and is never searched unless asked.
 */
async function searchComments(userId: number, isAdmin: boolean, q: string, m: Matcher): Promise<SearchGroup> {
  const params: unknown[] = [m.patterns];
  const scope = listScope(await forumViewer(userId, isAdmin), "fp", params);
  const rows = await query<{ id: number; post_id: number; content: string; created_at: string; title: string; author: string }>(
    `SELECT fc.id, fc.post_id, fc.content, fc.created_at, fp.title, COALESCE(u.display_name, u.username) AS author
     FROM forum_comments fc
     JOIN forum_posts fp ON fp.id = fc.post_id
     JOIN users u ON u.id = fc.user_id
     WHERE fp.hidden_at IS NULL AND fc.hidden_at IS NULL AND ${like(m, "fc.content", "$1")}${scope ? ` AND ${scope}` : ""}
     ORDER BY fc.created_at DESC
     LIMIT ${PER_GROUP + 1}`,
    params
  );
  const items: SearchItem[] = rows.slice(0, PER_GROUP).map((r) => ({
    id: `comment-${r.id}`,
    label: r.title,
    href: `/forum/${r.post_id}`,
    note: `Comment by ${r.author}`,
    snippet: snippetAround(stripMarkdown(r.content), q) ?? undefined,
    when: new Date(r.created_at).toISOString(),
  }));
  return { id: "comments", label: GROUP_LABELS.comments, items, more: rows.length > PER_GROUP };
}

/**
 * Everything that matches, in the window's order. `q` must already be cleaned (cleanQuery) and long enough. `today` is
 * the person's own day, for dates in words. `options` are the places the person ticked (cleanOptions); with none, only the
 * default places are searched.
 */
export async function search(
  userId: number,
  isAdmin: boolean,
  q: string,
  today = new Date().toISOString().slice(0, 10),
  options: SearchOption[] = []
): Promise<SearchGroup[]> {
  const m = await matcher(q);
  const none = (id: SearchGroup["id"]): SearchGroup => ({ id, label: GROUP_LABELS[id], items: [], more: false });
  const [concepts, oracle, meanings, readings, journals, predictions, guesses, yours, cloths, days, forum, earlier, comments] = await Promise.all([
    showsSensitive(userId).then(conceptEntries).then((entries): SearchGroup => {
      const { items, more } = rankEntries(entries, q);
      return { id: "concepts", label: GROUP_LABELS.concepts, items, more };
    }),
    searchOracle(userId, q, m),
    searchMeanings(userId, q, m),
    searchReadings(userId, q, m),
    searchJournals(userId, q, m),
    searchPredictions(userId, q, m),
    searchGuesses(userId, q, m),
    searchYours(userId, q, m),
    searchCloths(userId, q, m),
    searchDays(userId, q, m, today),
    searchForum(userId, isAdmin, q, m),
    options.includes("earlier") ? searchEarlier(userId, q, m) : none("earlier"),
    options.includes("comments") ? searchComments(userId, isAdmin, q, m) : none("comments"),
  ]);
  return orderGroups([...searchStatic(q, isAdmin), concepts, oracle, meanings, readings, journals, predictions, guesses, yours, cloths, days, earlier, forum, comments]);
}
