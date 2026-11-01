import { query } from "./db";
import { toISOString } from "./date";
import type { DivinationKind } from "./divination-kinds";
import { recurringSymbols, wordingShifts, type DrawRow, type Recurring, type Shift, type Version } from "./patterns-core";

// The symbols part of Patterns: what keeps coming up (across every tool) and how the person's own wording for a symbol has shifted. Split from
// lib/patterns.ts so the companion's pattern questions can use these two without touching the theme names and texts (stock text the companion must
// never see). Every query is for one person. `only` limits it to the tools given (null for every tool).

const SURFACE: Record<string, string> = { mirror: "dark mirror", ball: "crystal ball", water: "bowl of water" };

const iso = (d: string | Date) => toISOString(d);

export type DrawQueryRow = { kind: DivinationKind; key: string; name: string; divination_id: number; reading_id: number | null; created_at: string | Date };

/**
 * One row per symbol that came up with the I Ching, geomancy or bibliomancy. I Ching counts both hexagrams of a cast; geomancy counts the four Mothers (the cast itself) and the Judge (the answer), not
 * the figures derived from them, because nearly every figure appears somewhere in every chart; bibliomancy counts the single words that were pulled.
 */
async function loadNewToolRows(userId: number): Promise<DrawQueryRow[]> {
  return query<DrawQueryRow>(
    `SELECT 'iching' AS kind, 'hexagram-' || c.primary_number AS key, c.primary_name AS name, d.id AS divination_id, NULL::int AS reading_id, d.created_at
       FROM iching_casts c JOIN divinations d ON d.id = c.divination_id WHERE c.user_id = $1
     UNION ALL
     SELECT 'iching', 'hexagram-' || c.relating_number, c.relating_name, d.id, NULL, d.created_at
       FROM iching_casts c JOIN divinations d ON d.id = c.divination_id WHERE c.user_id = $1 AND c.relating_number IS NOT NULL
     UNION ALL
     SELECT 'geomancy', f.figure_id, f.figure_name, d.id, NULL, d.created_at
       FROM geomancy_figures f JOIN divinations d ON d.id = f.divination_id WHERE f.user_id = $1 AND (f.place LIKE 'mother%' OR f.place = 'judge')
     UNION ALL
     SELECT 'bibliomancy', lower(p.passage), p.passage, d.id, NULL, d.created_at
       FROM bibliomancy_pulls p JOIN divinations d ON d.id = p.divination_id WHERE p.user_id = $1 AND p.unit = 'word'`,
    [userId]
  );
}

/**
 * Playing cards and charm casts (migration 085). Each card drawn counts. For charm casting every charm of a set is
 * cast every time, so counting them would show nothing; what is counted is a charm that landed near the middle of the cloth (within 150 of 1000 of its centre).
 */
async function loadFourToolRows(userId: number): Promise<DrawQueryRow[]> {
  return query<DrawQueryRow>(
    `SELECT 'playingcards' AS kind, 'playing-' || p.card_id AS key, p.card_name AS name, d.id AS divination_id, NULL::int AS reading_id, d.created_at
       FROM playing_card_draws p JOIN divinations d ON d.id = p.divination_id WHERE p.user_id = $1
     UNION ALL
     SELECT 'charms', 'charm-middle:' || lower(c.charm_name), c.charm_name || ' (near the middle)', d.id, NULL, d.created_at
       FROM charm_casts c JOIN divinations d ON d.id = c.divination_id WHERE c.user_id = $1 AND (c.x - 500) * (c.x - 500) + (c.y - 500) * (c.y - 500) <= 22500`,
    [userId]
  );
}

/** The names of the hexagrams and figures the person has had come up, so the words they wrote for one can be matched to its tool and name. */
async function loadNewToolNames(userId: number): Promise<{ kind: DivinationKind; key: string; name: string }[]> {
  return query<{ kind: DivinationKind; key: string; name: string }>(
    `SELECT 'iching' AS kind, 'hexagram-' || primary_number AS key, MAX(primary_name) AS name FROM iching_casts WHERE user_id = $1 GROUP BY primary_number
     UNION ALL SELECT 'iching', 'hexagram-' || relating_number, MAX(relating_name) FROM iching_casts WHERE user_id = $1 AND relating_number IS NOT NULL GROUP BY relating_number
     UNION ALL SELECT 'geomancy', figure_id, MAX(figure_name) FROM geomancy_figures WHERE user_id = $1 GROUP BY figure_id
     UNION ALL SELECT 'playingcards', 'playing-' || card_id, MAX(card_name) FROM playing_card_draws WHERE user_id = $1 GROUP BY card_id`,
    [userId]
  );
}

/** One uniform row per symbol that came up, from every tool's own table (clarifier cards are not counted: they are not what the reading drew). */
export async function loadDrawRows(userId: number, only: DivinationKind[] | null): Promise<DrawQueryRow[]> {
  const rows = await query<DrawQueryRow>(
    `SELECT * FROM (
       SELECT 'tarot' AS kind, cd.card_id AS key, cd.card_name AS name, d.id AS divination_id, d.reading_id, d.created_at
         FROM card_draws cd JOIN divinations d ON d.reading_id = cd.reading_id WHERE cd.user_id = $1 AND cd.is_clarifier = 0
       UNION ALL
       SELECT 'runes', r.rune_id, r.rune_name, d.id, NULL, d.created_at FROM rune_draws r JOIN divinations d ON d.id = r.divination_id WHERE r.user_id = $1
       UNION ALL
       SELECT 'ogham', o.stave_id, o.stave_name, d.id, NULL, d.created_at FROM ogham_draws o JOIN divinations d ON d.id = o.divination_id WHERE o.user_id = $1
       UNION ALL
       SELECT 'oracle', COALESCE(p.card_id::text, 'name:' || p.card_name), p.card_name, d.id, NULL, d.created_at
         FROM oracle_pull_cards p JOIN divinations d ON d.id = p.divination_id WHERE p.user_id = $1
       UNION ALL
       SELECT 'dice', t.object || ':' || t.face,
              CASE WHEN t.object = 'coin' THEN 'coin: ' || t.face ELSE t.object || ' showing ' || t.face END, d.id, NULL, d.created_at
         FROM dice_throws t JOIN divinations d ON d.id = t.divination_id WHERE t.user_id = $1
       UNION ALL
       SELECT 'pendulum', COALESCE(a.swing_id::text, 'name:' || a.swing_name), a.swing_name, d.id, NULL, d.created_at
         FROM pendulum_answers a JOIN divinations d ON d.id = a.divination_id WHERE a.user_id = $1
       UNION ALL
       SELECT 'scrying', s.surface, s.surface, d.id, NULL, d.created_at FROM scrying_sessions s JOIN divinations d ON d.id = s.divination_id WHERE s.user_id = $1
     ) all_draws
     WHERE ($2::text[] IS NULL OR kind = ANY($2::text[]))`,
    [userId, only]
  );
  rows.push(...(await loadNewToolRows(userId)).filter((r) => only === null || only.includes(r.kind)));
  rows.push(...(await loadFourToolRows(userId)).filter((r) => only === null || only.includes(r.kind)));
  return rows;
}

export async function loadRecurring(userId: number, only: DivinationKind[] | null): Promise<Recurring[]> {
  const rows = await loadDrawRows(userId, only);
  return recurringSymbols(
    rows.map((r) => ({ ...r, name: r.kind === "scrying" ? SURFACE[r.key] ?? r.name : r.name, created_at: iso(r.created_at) } satisfies DrawRow))
  );
}

const wording = (keywords: string | null, description: string | null) => [keywords, description].map((s) => s?.trim()).filter(Boolean).join(" — ");

export async function loadShifts(userId: number, only: DivinationKind[] | null): Promise<Shift[]> {
  const allowed = (k: DivinationKind | null) => (k === null ? only === null : only === null || only.includes(k));
  const shifts: Shift[] = [];

  // Tarot, runes, ogham, and dice share one table of the person's own words, keyed by the symbol. The name and tool come from what they drew.
  const names = await query<{ kind: DivinationKind; key: string; name: string }>(
    `SELECT 'tarot' AS kind, card_id AS key, MAX(card_name) AS name FROM card_draws WHERE user_id = $1 GROUP BY card_id
     UNION ALL SELECT 'runes', rune_id, MAX(rune_name) FROM rune_draws WHERE user_id = $1 GROUP BY rune_id
     UNION ALL SELECT 'ogham', stave_id, MAX(stave_name) FROM ogham_draws WHERE user_id = $1 GROUP BY stave_id`,
    [userId]
  );
  const known = new Map([...names, ...(await loadNewToolNames(userId))].map((n) => [n.key, n]));
  const own = await query<{ card_id: string; up_k: string | null; rev_k: string | null; up_d: string | null; rev_d: string | null; at: string | Date }>(
    `SELECT card_id, upright_keywords AS up_k, reversed_keywords AS rev_k, upright_description AS up_d, reversed_description AS rev_d, created_at AS at
       FROM card_meaning_revisions WHERE user_id = $1
     UNION ALL
     SELECT card_id, upright_keywords, reversed_keywords, upright_description, reversed_description, updated_at FROM card_customizations WHERE user_id = $1`,
    [userId]
  );
  const byKey = new Map<string, Version[]>();
  for (const r of own) {
    const up = wording(r.up_k, r.up_d);
    const rev = wording(r.rev_k, r.rev_d);
    const text = [up, rev ? `Upside down: ${rev}` : ""].filter(Boolean).join("\n");
    byKey.set(r.card_id, [...(byKey.get(r.card_id) ?? []), { when: iso(r.at), text }]);
  }
  for (const [key, versions] of byKey) {
    let kind: DivinationKind | null = known.get(key)?.kind ?? null;
    let name = known.get(key)?.name ?? key;
    // A person's words for a whole suit or number (ids 'group-suit-cups', 'group-rank-5'; lib/card-groups.ts) are not a
    // symbol they drew, so they are not part of Patterns or of anything the companion is shown from here. The check is
    // written out here on purpose: this file may import only what tests/companion-pattern.test.ts allows.
    if (key.startsWith("group-")) continue;
    if (key.startsWith("coin-")) { kind = "dice"; name = `coin: ${key.slice(5)}`; }
    else if (key.startsWith("die-")) { kind = "dice"; const [, obj, face] = key.split("-"); name = `${obj} showing ${face}`; }
    else if (key.startsWith("hexagram-")) kind = "iching";
    else if (key.startsWith("geomancy-")) kind = "geomancy";
    else if (key.startsWith("playing-")) kind = "playingcards";
    if (allowed(kind)) shifts.push({ kind, key, name, versions });
  }

  if (allowed("pendulum")) {
    const sw = await query<{ id: number; name: string; content: string | null; at: string | Date }>(
      `SELECT s.id, COALESCE(NULLIF(s.name, ''), (SELECT a.swing_name FROM pendulum_answers a WHERE a.swing_id = s.id LIMIT 1), s.shape) AS name, r.content, r.created_at AS at
         FROM pendulum_swing_revisions r JOIN pendulum_swings s ON s.id = r.swing_id WHERE r.user_id = $1
       UNION ALL
       SELECT s.id, COALESCE(NULLIF(s.name, ''), (SELECT a.swing_name FROM pendulum_answers a WHERE a.swing_id = s.id LIMIT 1), s.shape), s.meaning, s.updated_at
         FROM pendulum_swings s WHERE s.user_id = $1 AND s.meaning IS NOT NULL`,
      [userId]
    );
    const bySwing = new Map<number, { name: string; versions: Version[] }>();
    for (const r of sw) {
      const e = bySwing.get(r.id) ?? { name: r.name, versions: [] };
      e.versions.push({ when: iso(r.at), text: r.content ?? "" });
      bySwing.set(r.id, e);
    }
    for (const [id, e] of bySwing) shifts.push({ kind: "pendulum", key: `swing-${id}`, name: e.name, versions: e.versions });
  }

  if (allowed("oracle")) {
    const om = await query<{ id: number; card_name: string; label: string | null; reversed: number; content: string; at: string | Date }>(
      `SELECT m.id, c.name AS card_name, m.label, m.reversed, rv.content, rv.created_at AS at
         FROM oracle_card_meaning_revisions rv JOIN oracle_card_meanings m ON m.id = rv.meaning_id JOIN oracle_cards c ON c.id = m.card_id WHERE rv.user_id = $1
       UNION ALL
       SELECT m.id, c.name, m.label, m.reversed, m.content, m.updated_at
         FROM oracle_card_meanings m JOIN oracle_cards c ON c.id = m.card_id WHERE m.user_id = $1`,
      [userId]
    );
    const byMeaning = new Map<number, { name: string; versions: Version[] }>();
    for (const r of om) {
      const name = `${r.card_name}${r.label ? ` (${r.label})` : ""}${r.reversed ? " (upside down)" : ""}`;
      const e = byMeaning.get(r.id) ?? { name, versions: [] };
      e.versions.push({ when: iso(r.at), text: r.content });
      byMeaning.set(r.id, e);
    }
    for (const [id, e] of byMeaning) shifts.push({ kind: "oracle", key: `meaning-${id}`, name: e.name, versions: e.versions });
  }

  return wordingShifts(shifts);
}
