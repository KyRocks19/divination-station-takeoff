import { query } from "./db";
import { DIVINATION_KINDS, type DivinationKind } from "./divination-kinds";
import { SUIT_META } from "./suit-meta";
import { AETT_NAMES, getRune } from "./runes-data";
import { AICME_NAMES, getStave } from "./ogham-data";
import { getObject } from "./dice-data";
import { SCRYING_SURFACE_LABELS, isScryingSurface } from "./scrying-surfaces";
import { TRIGRAMS, getHexagram } from "./iching-data";
import { LINE_ELEMENTS, getFigure } from "./geomancy-data";
import { SOURCE_WORDS, type SourceKind } from "./bibliomancy-core";
import { SUITS } from "./playingcards-data";
import { getTea, isTeaKind } from "./tea-core";
import { loadRecurring } from "./patterns-symbols";
import { SUMMARY_WORDS, byCount, toShares, type ToolSummary } from "./tool-summary-core";

export * from "./tool-summary-core";

// The summary of each tool for one person (open item PAT1). Every query is for one person.

type Counted = { id: string; n: string | number };

async function counted(sql: string, userId: number): Promise<Counted[]> {
  return query<Counted>(sql, [userId]);
}

/** Adds up counts under a group label, keeping the order in which labels first appear. */
function addUp(rows: { label: string; count: number }[]) {
  const sums = new Map<string, number>();
  for (const r of rows) sums.set(r.label, (sums.get(r.label) ?? 0) + r.count);
  return [...sums.entries()].map(([label, count]) => ({ id: label, label, count }));
}

const SWING_SHAPES: Record<string, string> = {
  line: "Lines (back and forth)",
  circle_cw: "Circles clockwise",
  circle_ccw: "Circles counter-clockwise",
  still: "Still",
};

async function groupsOf(userId: number, kind: DivinationKind) {
  const n = (r: Counted) => Number(r.n);
  switch (kind) {
    case "tarot": {
      const rows = await counted(
        `SELECT CASE WHEN card_id LIKE 'major-%' THEN 'major' WHEN card_id LIKE 'cups-%' THEN 'cups' WHEN card_id LIKE 'wands-%' THEN 'wands'
                     WHEN card_id LIKE 'swords-%' THEN 'swords' WHEN card_id LIKE 'pentacles-%' THEN 'pentacles' END AS id, COUNT(*) AS n
         FROM card_draws WHERE user_id = $1 AND is_clarifier = 0 GROUP BY 1`,
        userId
      );
      return ["major", "cups", "wands", "swords", "pentacles"].map((s) => ({
        id: s,
        label: SUIT_META[s].label,
        color: SUIT_META[s].color,
        count: n(rows.find((r) => r.id === s) ?? { id: s, n: 0 }),
      }));
    }
    case "runes": {
      const rows = await counted("SELECT rune_id AS id, COUNT(*) AS n FROM rune_draws WHERE user_id = $1 GROUP BY 1", userId);
      return addUp(rows.flatMap((r) => { const a = getRune(r.id)?.aett; return a ? [{ label: AETT_NAMES[a], count: n(r) }] : []; }));
    }
    case "ogham": {
      const rows = await counted("SELECT stave_id AS id, COUNT(*) AS n FROM ogham_draws WHERE user_id = $1 GROUP BY 1", userId);
      return byCount(addUp(rows.flatMap((r) => { const s = getStave(r.id); return s ? [{ label: AICME_NAMES[s.aicme], count: n(r) }] : []; })));
    }
    case "dice": {
      const rows = await counted("SELECT object AS id, COUNT(*) AS n FROM dice_throws WHERE user_id = $1 GROUP BY 1", userId);
      return byCount(rows.map((r) => ({ id: r.id, label: getObject(r.id)?.name ?? r.id, count: n(r) })));
    }
    case "pendulum": {
      const rows = await counted("SELECT shape AS id, COUNT(*) AS n FROM pendulum_answers WHERE user_id = $1 GROUP BY 1", userId);
      return byCount(rows.map((r) => ({ id: r.id, label: SWING_SHAPES[r.id] ?? r.id, count: n(r) })));
    }
    case "scrying": {
      const rows = await counted("SELECT surface AS id, COUNT(*) AS n FROM scrying_sessions WHERE user_id = $1 GROUP BY 1", userId);
      return byCount(rows.map((r) => ({ id: r.id, label: isScryingSurface(r.id) ? SCRYING_SURFACE_LABELS[r.id] : r.id, count: n(r) })));
    }
    case "oracle": {
      const rows = await counted(
        `SELECT p.deck_name AS id, COUNT(*) AS n FROM oracle_pull_cards c JOIN oracle_pulls p ON p.divination_id = c.divination_id
         WHERE c.user_id = $1 GROUP BY 1`,
        userId
      );
      return byCount(rows.map((r) => ({ id: r.id, label: r.id, count: n(r) })));
    }
    case "iching": {
      // Both trigrams of each first hexagram: a cast counts once under its lower trigram and once under its upper.
      const rows = await counted("SELECT primary_number::text AS id, COUNT(*) AS n FROM iching_casts WHERE user_id = $1 GROUP BY 1", userId);
      const sums = new Map<string, number>();
      for (const r of rows) {
        const h = getHexagram(Number(r.id));
        if (!h) continue;
        for (const t of [h.lower, h.upper]) sums.set(t, (sums.get(t) ?? 0) + n(r));
      }
      return TRIGRAMS.map((t) => ({ id: t.id, label: `${t.pinyin} (${t.english})`, count: sums.get(t.id) ?? 0 }));
    }
    case "geomancy": {
      // The figures of the cast (the four Mothers) and the answer (the Judge): how many of their lines are a single dot, under Fire, Air, Water and Earth.
      const rows = await counted(
        "SELECT figure_id AS id, COUNT(*) AS n FROM geomancy_figures WHERE user_id = $1 AND (place LIKE 'mother%' OR place = 'judge') GROUP BY 1",
        userId
      );
      const sums = [0, 0, 0, 0];
      for (const r of rows) getFigure(r.id)?.lines.forEach((v, i) => { if (v === 1) sums[i] += n(r); });
      return LINE_ELEMENTS.map((e, i) => ({ id: e, label: e, count: sums[i] }));
    }
    case "bibliomancy": {
      const rows = await counted("SELECT source_kind AS id, COUNT(*) AS n FROM bibliomancy_pulls WHERE user_id = $1 GROUP BY 1", userId);
      return byCount(rows.map((r) => ({ id: r.id, label: SOURCE_WORDS[r.id as SourceKind]?.label ?? r.id, count: n(r) })));
    }
    case "playingcards": {
      const rows = await counted("SELECT LEFT(card_id, 1) AS id, COUNT(*) AS n FROM playing_card_draws WHERE user_id = $1 GROUP BY 1", userId);
      return byCount(rows.map((r) => ({ id: r.id, label: SUITS.find((s) => s.id === r.id)?.name ?? r.id, count: n(r) })));
    }
    case "charms": {
      const rows = await counted("SELECT face AS id, COUNT(*) AS n FROM charm_casts WHERE user_id = $1 GROUP BY 1", userId);
      return byCount(rows.map((r) => ({ id: r.id, label: r.id === "up" ? "Landed face up" : "Landed face down", count: n(r) })));
    }
    case "signs": {
      const rows = await counted("SELECT note_type AS id, COUNT(*) AS n FROM sign_notes WHERE user_id = $1 GROUP BY 1", userId);
      return byCount(rows.map((r) => ({ id: r.id, label: r.id === "dream" ? "Dreams" : "Signs", count: n(r) })));
    }
    case "tea": {
      const rows = await counted("SELECT COALESCE(tea, '') AS id, COUNT(*) AS n FROM blot_casts WHERE user_id = $1 AND vessel = 'cup' GROUP BY 1", userId);
      return byCount(rows.map((r) => ({ id: r.id || "none", label: isTeaKind(r.id) ? getTea(r.id).label : "No tea chosen", count: n(r) })));
    }
    case "blots": {
      const rows = await counted("SELECT 'ink' AS id, COUNT(*) AS n FROM blot_casts WHERE user_id = $1 AND vessel = 'ink' GROUP BY 1", userId);
      return byCount(rows.map((r) => ({ id: r.id, label: "Ink blots", count: n(r) })));
    }
    case "remoteview": {
      // Only judged trials: a trial still waiting has no result, and its target is never read here.
      const rows = await counted(
        "SELECT CASE WHEN choice_index = target_index THEN 'hit' ELSE 'miss' END AS id, COUNT(*) AS n FROM remoteview_trials WHERE user_id = $1 AND judged_at IS NOT NULL GROUP BY 1",
        userId
      );
      return byCount(rows.map((r) => ({ id: r.id, label: r.id === "hit" ? "Chose the target" : "Chose another", count: n(r) })));
    }
  }
}

/** The tools given (null for every tool) that the person has used, each with its groups and what keeps coming up. */
export async function loadToolSummaries(userId: number, only: DivinationKind[] | null): Promise<ToolSummary[]> {
  const kinds = DIVINATION_KINDS.filter((k) => only === null || only.includes(k));
  const reads = await query<{ kind: DivinationKind; n: number }>("SELECT kind, COUNT(*)::int AS n FROM divinations WHERE user_id = $1 GROUP BY kind", [userId]);
  const readingsOf = new Map(reads.map((r) => [r.kind, r.n]));
  const used = kinds.filter((k) => (readingsOf.get(k) ?? 0) > 0);
  if (used.length === 0) return [];
  const recurring = await loadRecurring(userId, used);
  const out: ToolSummary[] = [];
  for (const kind of used) {
    const groups = toShares(await groupsOf(userId, kind));
    out.push({
      kind,
      readings: readingsOf.get(kind) ?? 0,
      noun: SUMMARY_WORDS[kind].noun,
      unit: SUMMARY_WORDS[kind].unit,
      groupTitle: SUMMARY_WORDS[kind].groupTitle,
      groups,
      recurring: recurring
        .filter((r) => r.kind === kind)
        .slice(0, 3)
        .map((r) => ({ name: r.name, count: r.count })),
    });
  }
  return out;
}
