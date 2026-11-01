import type { Shape } from "./edition";
import {
  DIVINATION_KINDS,
  DIVINATION_KIND_ICONS,
  DIVINATION_KIND_LABELS,
  DIVINATION_KIND_PAGES,
  type DivinationKind,
} from "./divination-kinds";

// The groups of the side navigation, as plain data. This file touches no database code and no browser code, so the
// structure can be checked without a browser and screens that run in the browser can import it. The home page draws its
// tiles from the same groups, so the two always use the same names, order and pictures.
//
// The header bar holds what is about the person rather than a place to go: the title, "+ New reading", their name,
// Settings and Log out. Those are not in these groups, so each link lives in one place.

export interface NavItem {
  /** Stable key for lists and tests. */
  id: string;
  label: string;
  /** Where the link goes. An action item has no address. */
  href?: string;
  /** Small picture shown before the label, in the navigation and on the home page's tiles. */
  icon?: string;
  /** One short line under the label on a home page tile. */
  note?: string;
  /** Other paths whose pages belong to this item, so it stays marked while a person is on them. */
  also?: string[];
  /** Shown to administrators only. */
  adminOnly?: boolean;
  /** Needs a server shared by other people, so a copy that runs on one person's computer does not have it (lib/edition-features.ts). */
  serverOnly?: boolean;
  /** Needs the app's makers' server, so a leader's copy that serves a circle (host mode) does not have it either. */
  noHost?: boolean;
  /** Needs a copy that keeps its data in a folder on this computer (local or host), so a hosted copy does not have it. */
  localOnly?: boolean;
  /** An AI feature, or one that needs another computer, so the Feathered edition does not have it (lib/edition-features.ts). */
  noFeathered?: boolean;
  /** "feedback" opens the feedback window over the page instead of going anywhere. */
  action?: "feedback";
  /** The side navigation draws it at the very top, above Your tools and outside every group; the home page and the search still read it from its group. */
  top?: boolean;
}

export interface NavGroup {
  id: "tools" | "writing" | "people" | "learn" | "help" | "admin";
  label: string;
  items: NavItem[];
}

/** Pages that belong to tarot but live outside /tarot. */
const TAROT_ALSO = ["/cards", "/encyclopedia", "/spreads"];

/** One item for each tool, in the order the app lists its tools. */
export const TOOL_ITEMS: (NavItem & { kind: DivinationKind })[] = DIVINATION_KINDS.map((kind) => ({
  id: `tool-${kind}`,
  kind,
  label: DIVINATION_KIND_LABELS[kind],
  href: DIVINATION_KIND_PAGES[kind],
  icon: DIVINATION_KIND_ICONS[kind],
  also: kind === "tarot" ? TAROT_ALSO : undefined,
}));

/**
 * The side navigation's one link for every tool (owner's request, 2026-10-25): "Your tools" opens the home page, whose tiles list the
 * tools and carry the stars. It stays marked on the home page and on every tool's pages.
 */
/**
 * Tossing lots: the items of a reading thrown onto one of the person's cloths (owner's request, 2026-10-31). It is a tool page of its own but
 * not a kind of reading, since what it tosses are the items of a reading made with another tool. The home page shows it after the tool tiles.
 */
export const LOTS_TOOL: NavItem = { id: "lots", label: "Tossing lots", href: "/lots", icon: "🪢", note: "Throw a reading onto your cloth" };

export const TOOLS_LINK: NavItem = {
  id: "tools",
  label: "Your tools",
  href: "/",
  also: [...TOOL_ITEMS.map((t) => t.href!), ...TAROT_ALSO, LOTS_TOOL.href!],
};

export const NAV_GROUPS: NavGroup[] = [
  // The tools are split into the ones the person starred and the rest (see visibleTools). The side navigation shows the group as one
  // link (TOOLS_LINK); the home page, the search and the Recent list still read its items.
  { id: "tools", label: "Your tools", items: TOOL_ITEMS },
  {
    id: "writing",
    label: "Your writings",
    items: [
      // First: the Days page is the hub that every other part opens from, with every reading on its day (owner's request, 2026-10-29).
      // The side navigation draws it at the very top, above Your tools and outside every group (owner's request, 2026-10-30).
      { id: "days", label: "Days", href: "/days", icon: "🗓️", note: "Every reading, day by day", top: true },
      { id: "readings", label: "Readings", href: "/readings", icon: "📜" },
      { id: "journals", label: "Journals", href: "/journals", icon: "📖" },
      { id: "patterns", label: "Patterns", href: "/insights", icon: "✦" },
      { id: "predictions", label: "Predictions", href: "/predictions", icon: "🔭" },
      { id: "questions", label: "Questions", href: "/questions", icon: "❔", note: "The same question, asked more than once" },
      { id: "layouts", label: "Layouts", href: "/layouts", icon: "📐", note: "Your own positions" },
    ],
  },
  {
    // The places shared with other people, above Learn (owner's request, 2026-10-30). Each needs a shared server, so a copy on one
    // person's computer has none of them and the group is left out there.
    id: "people",
    label: "Your people",
    items: [
      { id: "forum", label: "Forum", href: "/forum", icon: "💬", serverOnly: true },
      { id: "letters", label: "Letters", href: "/letters", icon: "✉️", note: "Readings for and from your circle", serverOnly: true },
      { id: "circle", label: "Your circle", href: "/circle", icon: "👥", note: "Your household or friends", serverOnly: true },
    ],
  },
  {
    id: "learn",
    label: "Learn",
    items: [
      { id: "library", label: "Library", href: "/library", icon: "🔮", also: ["/archetypes"] },
      { id: "sources", label: "Sources", href: "/sources", icon: "📚", note: "Where it all comes from" },
    ],
  },
  {
    id: "help",
    label: "Help and about",
    items: [
      { id: "guide", label: "How this works", href: "/guide", icon: "💡" },
      { id: "feedback", label: "Send feedback", icon: "✉️", action: "feedback", serverOnly: true, noHost: true },
      { id: "about", label: "About", href: "/about", icon: "🌙", also: ["/privacy"] },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    items: [
      { id: "users", label: "Users", href: "/admin/users", icon: "👥", adminOnly: true, serverOnly: true },
      { id: "reports", label: "Forum reports", href: "/forum/reports", icon: "🚩", adminOnly: true, serverOnly: true },
      { id: "workers", label: "Picture computers", href: "/admin/workers", icon: "🖥️", adminOnly: true, noFeathered: true },
      { id: "adminlog", label: "Admin log", href: "/admin/log", icon: "📜", adminOnly: true },
      { id: "host", label: "Host a circle", href: "/host", icon: "🏡", adminOnly: true, localOnly: true },
    ],
  },
];

/** The Settings link in the header, and the pages that count as Settings for marking it. */
export const SETTINGS_PATHS = ["/settings", "/design"];

/** The tools to list, split into the ones the person starred and the rest. Null means they starred every tool. */
export function visibleTools(chosen: DivinationKind[] | null): {
  shown: (NavItem & { kind: DivinationKind })[];
  rest: (NavItem & { kind: DivinationKind })[];
} {
  if (chosen === null) return { shown: TOOL_ITEMS, rest: [] };
  return {
    shown: TOOL_ITEMS.filter((t) => chosen.includes(t.kind)),
    rest: TOOL_ITEMS.filter((t) => !chosen.includes(t.kind)),
  };
}

/**
 * The starred tools after starring or unstarring one: null when every tool is starred, and null back (the request
 * refused) when it would leave no tool starred, because pages that follow the choice need at least one.
 */
export function toggleStar(
  chosen: DivinationKind[] | null,
  kind: DivinationKind
): { next: DivinationKind[] | null; starred: boolean } | null {
  const current = chosen ?? DIVINATION_KINDS;
  const on = current.includes(kind);
  const list = on ? current.filter((k) => k !== kind) : DIVINATION_KINDS.filter((k) => k === kind || current.includes(k));
  if (list.length === 0) return null;
  return { next: list.length === DIVINATION_KINDS.length ? null : list, starred: !on };
}

/**
 * The parts of the navigation a person can fold away: each group but Your tools, which is one link, and Recent. "tools" and "tools-rest"
 * (the folds of the old list of tools) may still be saved in an account; they are dropped when read.
 */
export const NAV_FOLD_KEYS = ["writing", "recent", "people", "learn", "help", "admin"] as const;
export type NavFoldKey = (typeof NAV_FOLD_KEYS)[number];

/** How the navigation starts: every group open. */
export const DEFAULT_NAV_FOLDED: NavFoldKey[] = [];

/** The known keys of a list, once each, in NAV_FOLD_KEYS order; anything else is dropped. Null when it is not a list. */
export function cleanNavFolded(list: unknown): NavFoldKey[] | null {
  if (!Array.isArray(list)) return null;
  return NAV_FOLD_KEYS.filter((k) => list.includes(k));
}

/** The folded parts as kept in the account (users.nav_folded): null is the starting arrangement, "" is nothing folded. */
export function parseNavFolded(raw: string | null | undefined): NavFoldKey[] {
  if (raw === null || raw === undefined) return DEFAULT_NAV_FOLDED;
  return cleanNavFolded(raw.split(",").map((k) => k.trim())) ?? DEFAULT_NAV_FOLDED;
}

/** The folded parts after one is folded or opened. */
export function toggleFold(folded: NavFoldKey[], key: NavFoldKey): NavFoldKey[] {
  return folded.includes(key) ? folded.filter((k) => k !== key) : NAV_FOLD_KEYS.filter((k) => k === key || folded.includes(k));
}

/**
 * The groups a person may see: administrator links only for administrators, links that need a shared server only on a hosted copy
 * (`local`, a copy for one person, leaves them out; `host`, a leader's copy that serves a circle, keeps them except the ones marked `noHost`),
 * and no group left empty.
 */
export function groupsFor(isAdmin: boolean, edition: Shape = "hosted"): NavGroup[] {
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => itemShown(i, isAdmin, edition)),
  })).filter((g) => g.items.length > 0);
}

/**
 * The side navigation's shape: the links drawn at the very top, outside every group (Days), and the groups without them. A group left
 * empty by this is dropped.
 */
export function sideNavFor(isAdmin: boolean, edition: Shape = "hosted"): { top: NavItem[]; groups: NavGroup[] } {
  const groups = groupsFor(isAdmin, edition);
  return {
    top: groups.flatMap((g) => g.items.filter((i) => i.top)),
    groups: groups.map((g) => ({ ...g, items: g.items.filter((i) => !i.top) })).filter((g) => g.items.length > 0),
  };
}

type ItemFlags =Pick<NavItem, "adminOnly" | "serverOnly" | "noHost" | "localOnly" | "noFeathered">;

/** Whether a link with these marks is offered on this kind of copy. The navigation, the home page's tiles and the search all ask this one question. */
export function itemShown(i: ItemFlags, isAdmin: boolean, edition: Shape): boolean {
  if (i.adminOnly && !isAdmin) return false;
  if (edition === "hosted") return !i.localOnly;
  if (edition === "host") return !i.noHost;
  if (edition === "feathered") return !i.serverOnly && !i.noFeathered;
  return !i.serverOnly;
}

function matches(pathname: string, base: string): boolean {
  if (base === "/") return pathname === "/";
  return pathname === base || pathname.startsWith(base + "/");
}

/** True on Settings and the pages that belong to it (the colour lab). */
export function onSettings(pathname: string): boolean {
  return SETTINGS_PATHS.some((base) => matches(pathname, base));
}

/**
 * The one item a path belongs to: the longest matching address wins, so /oracle/pulls lights Oracle Deck and
 * /forum/reports lights Forum reports rather than Forum. Null when nothing matches (the home page, for example).
 */
export function activeItemId(pathname: string): string | null {
  let best: { id: string; length: number } | null = null;
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      for (const base of [item.href, ...(item.also ?? [])]) {
        if (!base || !matches(pathname, base)) continue;
        if (best === null || base.length > best.length) best = { id: item.id, length: base.length };
      }
    }
  }
  return best?.id ?? null;
}
