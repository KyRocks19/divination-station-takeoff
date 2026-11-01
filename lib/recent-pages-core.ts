import { NAV_GROUPS } from "./nav-groups";

// The "Recent" list in the side navigation: the last few pages a person opened, kept on their own device. This file
// touches no database code and no browser code, so the browser and the tests can both import it.

/** How many pages the list keeps. */
export const RECENT_MAX = 6;

export interface RecentPage {
  /** The page's address without a query, for example "/readings/12". */
  path: string;
  /** The page's name as the tab shows it, without the site's name. */
  title: string;
}

/** Places that are not worth listing: the sign-in screens, Settings, the admin pages, and the home page. */
const SKIPPED = ["/", "/login", "/join", "/welcome", "/recover", "/settings", "/design", "/admin", "/privacy"];

/** Every address the navigation already links to. A page at exactly one of these is already one click away. The tools are not in the menu
 * (Your tools is one link to the home page since 2026-10-25), so a tool's own page can be listed. */
const IN_THE_MENU = new Set(
  NAV_GROUPS.filter((g) => g.id !== "tools").flatMap((g) => g.items.map((i) => i.href)).filter((h): h is string => !!h)
);

/** True for a page that belongs in the list. */
export function recordable(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("?") || path.includes("#")) return false;
  if (path === "/") return false;
  if (SKIPPED.some((s) => path === s || path.startsWith(s + "/"))) return false;
  return !IN_THE_MENU.has(path);
}

const SITE_NAME = "Divination Station";

/** A page title ready to show: the site's name taken off, trimmed and cut short. Null when it says nothing. */
export function cleanTitle(raw: string): string | null {
  let t = raw.trim();
  if (t.endsWith(`· ${SITE_NAME}`)) t = t.slice(0, -`· ${SITE_NAME}`.length).trim();
  if (!t || t === SITE_NAME) return null;
  return t.length > 80 ? `${t.slice(0, 79).trimEnd()}…` : t;
}

/** The list with this page first and any earlier copy of it taken out, cut to the most it keeps. */
export function addRecent(list: RecentPage[], page: RecentPage, max = RECENT_MAX): RecentPage[] {
  return [page, ...list.filter((p) => p.path !== page.path)].slice(0, max);
}

/** Reads a saved list. Anything that is not a list of pages with plain addresses gives an empty list. */
export function parseRecent(raw: string | null | undefined): RecentPage[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const out: RecentPage[] = [];
    for (const d of data) {
      if (!d || typeof d !== "object") continue;
      const { path, title } = d as Record<string, unknown>;
      if (typeof path !== "string" || typeof title !== "string" || !recordable(path)) continue;
      const clean = cleanTitle(title);
      if (clean) out.push({ path, title: clean });
    }
    return out.slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}
