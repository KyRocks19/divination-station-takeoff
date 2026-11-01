// The summary every tool shows on the home page and on Insights (open item PAT1, decided 2026-10-18): a ring and a list that say how what came up is spread
// over the tool's groups (for tarot, the suits and the Major Arcana, as before), and what keeps coming up. Counts only: it never says what any group
// means. This file touches no database code, so the screens that draw it, in the browser or on the server, can import it.

import { DIVINATION_KIND_LABELS, type DivinationKind } from "./divination-kinds";

export interface GroupShare {
  id: string;
  label: string;
  color: string;
  count: number;
  /** Share of the tool's total, 0 to 100. */
  percentage: number;
}

export interface ToolSummary {
  kind: DivinationKind;
  /** Readings the person has made with this tool. */
  readings: number;
  /** What the groups count, for the line under the title: "cards", "runes". */
  noun: string;
  /** One of them, for the ring's tooltip: "card", "rune". */
  unit: string;
  /** What the groups are called together: "Suits", "The three groups of runes". */
  groupTitle: string;
  groups: GroupShare[];
  /** Things that came up in two or more readings, most often first (at most three). */
  recurring: { name: string; count: number }[];
}

/** Words for each tool's summary: what is counted and how the groups are named. */
export const SUMMARY_WORDS: Record<DivinationKind, { noun: string; unit: string; groupTitle: string }> = {
  tarot: { noun: "cards", unit: "card", groupTitle: "Suits and Major Arcana" },
  oracle: { noun: "items", unit: "item", groupTitle: "Your sets" },
  scrying: { noun: "sessions", unit: "session", groupTitle: "Surfaces" },
  pendulum: { noun: "answers", unit: "answer", groupTitle: "Kinds of swing" },
  runes: { noun: "runes", unit: "rune", groupTitle: "The three groups of runes" },
  ogham: { noun: "staves", unit: "stave", groupTitle: "Groups of staves" },
  dice: { noun: "throws", unit: "throw", groupTitle: "What you threw" },
  iching: { noun: "trigrams", unit: "trigram", groupTitle: "Trigrams in your hexagrams" },
  geomancy: { noun: "lines", unit: "line", groupTitle: "Single dots by line" },
  bibliomancy: { noun: "passages", unit: "passage", groupTitle: "Where the passages came from" },
  playingcards: { noun: "cards", unit: "card", groupTitle: "Suits" },
  charms: { noun: "charms", unit: "charm", groupTitle: "How the charms landed" },
  signs: { noun: "notes", unit: "note", groupTitle: "Signs and dreams" },
  remoteview: { noun: "trials", unit: "trial", groupTitle: "Hits and misses" },
  tea: { noun: "cups", unit: "cup", groupTitle: "Teas" },
  blots: { noun: "blots", unit: "blot", groupTitle: "Ink blots" },
};

/** The colours of the groups of a tool that has no colours of its own (tarot keeps its suit colours). Distinct hues; the list also names each group, so colour is never the only sign. */
export const GROUP_COLORS = ["#7c3aed", "#3b82f6", "#f59e0b", "#10b981", "#ec4899", "#94a3b8", "#ef4444", "#14b8a6"];

/** The groups as shares of their total, in the order given, with the colour of each. Groups with nothing in them are left out. */
export function toShares(entries: { id: string; label: string; count: number; color?: string }[]): GroupShare[] {
  const kept = entries.filter((e) => e.count > 0);
  const total = kept.reduce((n, e) => n + e.count, 0);
  return kept.map((e, i) => ({
    id: e.id,
    label: e.label,
    count: e.count,
    color: e.color ?? GROUP_COLORS[i % GROUP_COLORS.length],
    percentage: total > 0 ? (e.count / total) * 100 : 0,
  }));
}

/** The same shares, the biggest first. */
export const byCount = <T extends { count: number }>(rows: T[]): T[] => [...rows].sort((a, b) => b.count - a.count);

/** The ring's accessible name: "Runes: how what came up is spread over the groups". */
export function ringLabel(kind: DivinationKind): string {
  return `${DIVINATION_KIND_LABELS[kind]}: how what came up is spread over ${SUMMARY_WORDS[kind].groupTitle.toLowerCase()}`;
}
