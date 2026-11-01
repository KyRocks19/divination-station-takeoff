// Recent searches (migration 071), the parts with no database code so the search window and the tests can use them.
// lib/recent-searches.ts reads and writes the rows. Off until the person turns it on; only they ever see the list.

import { MAX_QUERY, MIN_QUERY, cleanQuery } from "./search-shared";

/** The most searches kept for one person. The oldest go first. */
export const MAX_RECENT = 20;

export interface RecentSearch {
  id: number;
  query: string;
  /** An ISO time. */
  searched_at: string;
}

/** What the search window is told: whether the person turned it on, and the list. */
export interface RecentState {
  on: boolean;
  items: RecentSearch[];
}

export const NO_RECENT: RecentState = { on: false, items: [] };

/** The words to keep, or null when they are too short or not words at all. Same cleaning as the search itself. */
export function recentToKeep(raw: unknown): string | null {
  const q = cleanQuery(raw);
  return q.length >= MIN_QUERY && q.length <= MAX_QUERY ? q : null;
}

/** The person's recent searches for the data export: the words they searched for and when, newest first. */
export interface RecentExport {
  recent_searches: {
    remembering: boolean;
    searches: { words: string; searched_at: string }[];
  };
}

export function shapeRecentExport(state: RecentState): RecentExport {
  return {
    recent_searches: {
      remembering: state.on,
      searches: state.items.map((s) => ({ words: s.query, searched_at: s.searched_at })),
    },
  };
}

/** Markdown lines for the readable export. Nothing at all when the person never turned the feature on and has none. */
export function recentMarkdown(data: RecentExport): string[] {
  const { remembering, searches } = data.recent_searches;
  if (!remembering && searches.length === 0) return [];
  const out = ["", "## Recent searches", ""];
  out.push(remembering ? "Remembering recent searches is on." : "Remembering recent searches is off.");
  if (searches.length) {
    out.push("");
    for (const s of searches) out.push(`- ${s.words} (${s.searched_at.slice(0, 10)})`);
  }
  return out;
}
