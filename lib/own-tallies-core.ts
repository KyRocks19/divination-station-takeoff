// How often the pieces a person linked to their own archetypes and concepts came up in their readings. Pure: the rows go in,
// the counts come out, so it can be tested. lib/own-tallies.ts reads the rows. These counts are the person's own and are
// always shown apart from the shared archetype counts in lib/archetype-tallies.ts; the two are never added together.

import type { DivinationKind } from "./divination-kinds";
import type { OwnLink } from "./own-archetypes";

/** One piece of one tool that came up `n` times. A person's own oracle item has the piece "oracle:ID". */
export interface DrawCount {
  tool: DivinationKind;
  piece: string;
  n: number;
  /** The month it came up, "2026-10" (UTC), for the counts by month. Left off where only a total is wanted. */
  month?: string;
}

export interface OwnTally {
  /** "a:ID" for one of their archetypes, "c:ID" for one of their concepts, "s:slug" for a shared archetype they linked to themselves. */
  key: string;
  name: string;
  kind: "your archetype" | "your concept" | "shared archetype you linked";
  /** The shared archetype's page, for a link to one; their own have no page of their own yet. */
  slug: string | null;
  /** Times a piece they linked here came up, by tool. */
  byTool: Partial<Record<DivinationKind, number>>;
  total: number;
}

/** The piece key a link points at, matching DrawCount.piece. */
export function pieceKey(piece: OwnLink["piece"]): string {
  return piece.kind === "symbol" ? piece.id : `oracle:${piece.id}`;
}

/** Counts, for each target a person linked pieces to, how many times those pieces came up. Most often first. */
export function tallyOwn(links: OwnLink[], draws: DrawCount[]): OwnTally[] {
  const byPiece = new Map<string, OwnLink[]>();
  for (const l of links) {
    const k = pieceKey(l.piece);
    byPiece.set(k, [...(byPiece.get(k) ?? []), l]);
  }
  const out = new Map<string, OwnTally>();
  for (const d of draws) {
    if (d.n <= 0) continue;
    for (const l of byPiece.get(d.piece) ?? []) {
      const t = l.target;
      const key = t.kind === "archetype" ? `s:${t.slug}` : `${t.kind === "user_archetype" ? "a" : "c"}:${t.id}`;
      const row = out.get(key) ?? {
        key,
        name: t.name,
        kind: t.kind === "archetype" ? "shared archetype you linked" : t.kind === "user_archetype" ? "your archetype" : "your concept",
        slug: t.kind === "archetype" ? t.slug : null,
        byTool: {},
        total: 0,
      } satisfies OwnTally;
      row.byTool[d.tool] = (row.byTool[d.tool] ?? 0) + d.n;
      row.total += d.n;
      out.set(key, row);
    }
  }
  return [...out.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

/** One month of the person's own themes: their own archetypes and concepts that their linked pieces touched, most often first. */
export interface OwnMonthThemes {
  /** "2026-10" */
  month: string;
  themes: { key: string; name: string; kind: "your archetype" | "your concept"; count: number }[];
}

/** The latest months shown, and the themes shown in each. The same sizes as the shared themes. */
export const OWN_THEME_MONTHS = 12;
export const OWN_THEMES_PER_MONTH = 6;

/**
 * "Themes over time" for the person's own archetypes and concepts: for each month, how many times a piece they linked to
 * one of them came up. Only their own archetypes and concepts count here; a shared archetype they linked pieces to is the
 * shared themes' business and is left out so nothing is counted twice. Newest month first, months with nothing left out.
 * Pure; the counts are never added to the shared ones.
 */
export function ownThemesByMonth(links: OwnLink[], draws: DrawCount[]): OwnMonthThemes[] {
  const byPiece = new Map<string, OwnLink[]>();
  for (const l of links) {
    if (l.target.kind === "archetype") continue;
    const k = pieceKey(l.piece);
    byPiece.set(k, [...(byPiece.get(k) ?? []), l]);
  }
  const months = new Map<string, Map<string, { name: string; kind: "your archetype" | "your concept"; count: number }>>();
  for (const d of draws) {
    if (d.n <= 0 || !d.month) continue;
    for (const l of byPiece.get(d.piece) ?? []) {
      const t = l.target;
      if (t.kind === "archetype") continue;
      const key = `${t.kind === "user_archetype" ? "a" : "c"}:${t.id}`;
      const month = months.get(d.month) ?? new Map();
      const row = month.get(key) ?? { name: t.name, kind: t.kind === "user_archetype" ? "your archetype" : "your concept", count: 0 };
      row.count += d.n;
      month.set(key, row);
      months.set(d.month, month);
    }
  }
  return [...months.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, OWN_THEME_MONTHS)
    .map(([month, m]) => ({
      month,
      themes: [...m.entries()]
        .map(([key, v]) => ({ key, ...v }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        .slice(0, OWN_THEMES_PER_MONTH),
    }))
    .filter((m) => m.themes.length > 0);
}
