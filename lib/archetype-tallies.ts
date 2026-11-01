// Counts how often each shared archetype (lib/archetypes-data.ts) shows up in one person's readings, across every
// tool that has archetypes. Server code only: it imports the database.
//
// A reading touches an archetype when a symbol in it is matched to the archetype. For tarot the match goes through the
// card's concepts, and the concepts say which side of the archetype the card shows (the side that goes well, the hard
// side, or both in one card). The other tools have one meaning per symbol, so a symbol counts as "either" unless its
// link names a side (a warning in a poem is the hard side); a rune that lands upside down counts as the hard side, since
// that is what turning a rune over is for in modern use. A symbol's links come from the database (migration 059) where it
// has a record there, and from the older mapping in code where it does not (lib/symbol-links-core.ts).
//
// The same pass also counts by month (UTC), for "themes over time" on the Patterns page, and can leave out tools the person has hidden.

import { query } from "@/lib/db";
import { getArchetype } from "@/lib/archetypes-data";
import {
  COIN_MEANINGS, OGHAM_MEANINGS, PENDULUM_MEANINGS, RUNE_MEANINGS, SCRYING_MEANINGS, numberMeaning, pendulumKey,
} from "@/lib/common-meanings-data";
import { faceId, getObject, isNumbered, type DiceObjectId } from "@/lib/dice-data";
import type { DivinationKind } from "@/lib/divination-kinds";
import { loadSymbolStore } from "@/lib/symbol-links";
import { sideOf } from "@/lib/symbol-links-core";
import { visibleLinksOf } from "@/lib/hidden-links-core";
import { loadHidden } from "@/lib/hidden-links";

export interface SideCounts { light: number; shadow: number; either: number }
export interface ArchetypeTally {
  slug: string;
  name: string;
  /** Times this archetype came up, by the tool it came from. */
  byTool: Partial<Record<DivinationKind, SideCounts>>;
}

interface Counted {
  tallies: Map<string, ArchetypeTally>;
  /** month ("2026-10") to archetype slug to how many times it came up that month, in the tools counted. */
  months: Map<string, Map<string, number>>;
}

async function countArchetypes(userId: number, only: DivinationKind[] | null): Promise<Counted> {
  const tallies = new Map<string, ArchetypeTally>();
  const months = new Map<string, Map<string, number>>();
  const [store, hidden] = await Promise.all([loadSymbolStore(), loadHidden(userId)]);
  const wants = (k: DivinationKind) => only === null || only.includes(k);
  function add(slug: string, kind: DivinationKind, side: keyof SideCounts, n: number, month: string) {
    const a = getArchetype(slug);
    if (!a || n <= 0) return;
    const t = tallies.get(slug) ?? { slug, name: a.name, byTool: {} };
    const c = (t.byTool[kind] ??= { light: 0, shadow: 0, either: 0 });
    c[side] += n;
    tallies.set(slug, t);
    const m = months.get(month) ?? new Map<string, number>();
    m.set(slug, (m.get(slug) ?? 0) + n);
    months.set(month, m);
  }
  const MONTH = (col: string) => `to_char(${col} AT TIME ZONE 'UTC', 'YYYY-MM')`;

  // Tarot: each drawn card (not a clarifier) counts once per archetype, on the side its concepts for the card's
  // orientation show; a card whose concepts for that archetype are on both sides counts as either.
  if (wants("tarot")) {
    const tarot = await query<{ slug: string; month: string; light: string; shadow: string; either: string }>(
      `WITH per_draw AS (
         SELECT d.id AS draw_id, a.slug, ${MONTH("d.created_at")} AS month,
                BOOL_OR(ca.aspect = 'shadow') AS has_shadow,
                BOOL_OR(ca.aspect <> 'shadow') AS has_light
           FROM card_draws d
           JOIN card_concepts cc ON cc.card_id = d.card_id AND cc.reversed = (d.reversed = 1)
           JOIN concept_archetypes ca ON ca.concept_id = cc.concept_id
           JOIN archetypes a ON a.id = ca.archetype_id
          WHERE d.user_id = $1 AND d.is_clarifier = 0
          GROUP BY d.id, a.slug, month
       )
       SELECT slug, month,
              COUNT(*) FILTER (WHERE has_light AND NOT has_shadow) AS light,
              COUNT(*) FILTER (WHERE has_shadow AND NOT has_light) AS shadow,
              COUNT(*) FILTER (WHERE has_light AND has_shadow)     AS either
         FROM per_draw GROUP BY slug, month`,
      [userId]
    );
    for (const r of tarot) {
      add(r.slug, "tarot", "light", Number(r.light), r.month);
      add(r.slug, "tarot", "shadow", Number(r.shadow), r.month);
      add(r.slug, "tarot", "either", Number(r.either), r.month);
    }
  }

  if (wants("runes")) {
    const runes = await query<{ rune_id: string; reversed: number; month: string; n: string }>(
      `SELECT r.rune_id, r.reversed, ${MONTH("dv.created_at")} AS month, COUNT(*) AS n
         FROM rune_draws r JOIN divinations dv ON dv.id = r.divination_id
        WHERE r.user_id = $1 GROUP BY r.rune_id, r.reversed, month`,
      [userId]
    );
    for (const r of runes) for (const l of visibleLinksOf(store, hidden, r.rune_id, RUNE_MEANINGS[r.rune_id]?.archetypes ?? [])) add(l.slug, "runes", sideOf(l, !!r.reversed), Number(r.n), r.month);
  }

  if (wants("ogham")) {
    const ogham = await query<{ stave_id: string; month: string; n: string }>(
      `SELECT o.stave_id, ${MONTH("dv.created_at")} AS month, COUNT(*) AS n
         FROM ogham_draws o JOIN divinations dv ON dv.id = o.divination_id
        WHERE o.user_id = $1 GROUP BY o.stave_id, month`,
      [userId]
    );
    for (const r of ogham) for (const l of visibleLinksOf(store, hidden, r.stave_id, OGHAM_MEANINGS[r.stave_id]?.archetypes ?? [])) add(l.slug, "ogham", sideOf(l, false), Number(r.n), r.month);
  }

  if (wants("dice")) {
    const dice = await query<{ object: string; face: string; month: string; n: string }>(
      `SELECT t.object, t.face, ${MONTH("dv.created_at")} AS month, COUNT(*) AS n
         FROM dice_throws t JOIN divinations dv ON dv.id = t.divination_id
        WHERE t.user_id = $1 GROUP BY t.object, t.face, month`,
      [userId]
    );
    for (const r of dice) {
      const slugs =
        r.object === "coin"
          ? COIN_MEANINGS[`coin-${r.face}`]?.archetypes
          : isNumbered(r.object) ? numberMeaning(Number(r.face), getObject(r.object)!.faces).archetypes : undefined;
      const id = faceId(r.object as DiceObjectId, r.face);
      for (const l of visibleLinksOf(store, hidden, id, slugs ?? [])) add(l.slug, "dice", sideOf(l, false), Number(r.n), r.month);
    }
  }

  if (wants("pendulum")) {
    const pendulum = await query<{ shape: string; angle: number | null; builtin: number | null; month: string; n: string }>(
      `SELECT a.shape, a.angle, s.builtin, ${MONTH("dv.created_at")} AS month, COUNT(*) AS n
         FROM pendulum_answers a
         JOIN divinations dv ON dv.id = a.divination_id
         LEFT JOIN pendulum_swings s ON s.id = a.swing_id
        WHERE a.user_id = $1 GROUP BY a.shape, a.angle, s.builtin, month`,
      [userId]
    );
    for (const r of pendulum) {
      const key = pendulumKey({ shape: r.shape, angle: r.angle, builtin: r.builtin ?? 1 });
      if (!key) continue;
      for (const l of visibleLinksOf(store, hidden, key, PENDULUM_MEANINGS[key]?.archetypes ?? [])) add(l.slug, "pendulum", sideOf(l, false), Number(r.n), r.month);
    }
  }

  if (wants("scrying")) {
    const scrying = await query<{ surface: string; month: string; n: string }>(
      `SELECT sc.surface, ${MONTH("dv.created_at")} AS month, COUNT(*) AS n
         FROM scrying_sessions sc JOIN divinations dv ON dv.id = sc.divination_id
        WHERE sc.user_id = $1 GROUP BY sc.surface, month`,
      [userId]
    );
    for (const r of scrying) for (const l of visibleLinksOf(store, hidden, `scrying-${r.surface}`, SCRYING_MEANINGS[`scrying-${r.surface}`]?.archetypes ?? [])) add(l.slug, "scrying", sideOf(l, false), Number(r.n), r.month);
  }

  return { tallies, months };
}

/** All archetypes that came up at least once, in no particular order. */
export async function archetypeTallies(userId: number): Promise<ArchetypeTally[]> {
  return [...(await countArchetypes(userId, null)).tallies.values()];
}

/** The counts for the tools given (null for every tool), for the home page's themes. */
export async function archetypeTalliesFor(userId: number, only: DivinationKind[] | null): Promise<ArchetypeTally[]> {
  return [...(await countArchetypes(userId, only)).tallies.values()];
}

/** The same counts by month, for the tools given (null for every tool). */
export async function archetypeMonths(userId: number, only: DivinationKind[] | null): Promise<Map<string, Map<string, number>>> {
  return (await countArchetypes(userId, only)).months;
}
