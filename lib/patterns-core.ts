import { divinationPath, type DivinationKind } from "./divination-kinds";

// The counting behind the Patterns page's "across all your tools" block (slice 7). Pure: rows in, plain counts and dates out, so it is tested without
// a database. Nothing here interprets anything: it counts, orders, and dates what the person did and wrote. The queries that fetch the rows are in
// lib/patterns.ts.

// --- Symbols that keep coming up ---

export interface DrawRow {
  kind: DivinationKind;
  /** Identifies the symbol within its tool (a card id, rune id, stave id, die face, swing, or surface). */
  key: string;
  name: string;
  divination_id: number;
  /** Tarot only: the reading's own id, which is what its page is opened by. */
  reading_id: number | null;
  created_at: string;
}

export interface Recurring {
  kind: DivinationKind;
  key: string;
  name: string;
  /** In how many different readings it came up. */
  count: number;
  /** The most recent readings it came up in, oldest first, each with its link. */
  entries: { when: string; href: string; /** The shared record of the reading it came up in. */ id: number }[];
  /** How many earlier readings are not listed. */
  earlier: number;
}

export const RECURRING_MIN = 2;
export const RECURRING_MAX_ITEMS = 40;
export const RECURRING_MAX_ENTRIES = 12;

/** Every symbol that came up in two or more different readings, most often first. A symbol twice in one reading counts once. */
export function recurringSymbols(rows: DrawRow[]): Recurring[] {
  const groups = new Map<string, { kind: DivinationKind; key: string; name: string; byReading: Map<number, DrawRow> }>();
  for (const r of rows) {
    const id = `${r.kind}:${r.key}`;
    const g = groups.get(id) ?? { kind: r.kind, key: r.key, name: r.name, byReading: new Map<number, DrawRow>() };
    g.name = r.name;
    if (!g.byReading.has(r.divination_id)) g.byReading.set(r.divination_id, r);
    groups.set(id, g);
  }
  const out: Recurring[] = [];
  for (const g of groups.values()) {
    if (g.byReading.size < RECURRING_MIN) continue;
    const dated = [...g.byReading.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.divination_id - b.divination_id);
    const shown = dated.slice(-RECURRING_MAX_ENTRIES);
    out.push({
      kind: g.kind,
      key: g.key,
      name: g.name,
      count: dated.length,
      entries: shown.map((d) => ({ when: d.created_at, href: divinationPath(d.kind, d.divination_id, d.reading_id), id: d.divination_id })),
      earlier: dated.length - shown.length,
    });
  }
  return out
    .sort((a, b) => b.count - a.count || b.entries[b.entries.length - 1].when.localeCompare(a.entries[a.entries.length - 1].when) || a.name.localeCompare(b.name))
    .slice(0, RECURRING_MAX_ITEMS);
}

// --- How the person's own wording has shifted ---

export interface Version {
  when: string;
  text: string;
}

/**
 * The person's wordings of one thing in the order they wrote them: oldest first, blank ones dropped, and a wording that repeats the one before it
 * left out (saving without changing is not a change). The words are theirs, untouched apart from trimmed ends.
 */
export function distinctVersions(versions: Version[]): Version[] {
  const sorted = versions
    .map((v) => ({ when: v.when, text: v.text.trim() }))
    .filter((v) => v.text.length > 0)
    .sort((a, b) => a.when.localeCompare(b.when));
  const out: Version[] = [];
  for (const v of sorted) if (out.length === 0 || out[out.length - 1].text !== v.text) out.push(v);
  return out;
}

export interface Shift {
  kind: DivinationKind | null;
  key: string;
  name: string;
  versions: Version[];
}

export const SHIFTS_MAX_ITEMS = 40;

/** Things the person has worded at least twice, differently, the most recently changed first. */
export function wordingShifts(items: Shift[]): Shift[] {
  return items
    .map((i) => ({ ...i, versions: distinctVersions(i.versions) }))
    .filter((i) => i.versions.length >= 2)
    .sort((a, b) => b.versions[b.versions.length - 1].when.localeCompare(a.versions[a.versions.length - 1].when) || a.name.localeCompare(b.name))
    .slice(0, SHIFTS_MAX_ITEMS);
}

// --- Themes over time ---

export interface MonthThemes {
  /** "2026-10" */
  month: string;
  themes: { slug: string; name: string; count: number }[];
}

export const THEME_MONTHS = 12;
export const THEMES_PER_MONTH = 6;

/** The latest months that have anything, newest first, each with its most frequent themes (ties in name order). */
export function themesByMonth(months: Map<string, Map<string, number>>, nameOf: (slug: string) => string | null): MonthThemes[] {
  return [...months.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, THEME_MONTHS)
    .map(([month, counts]) => ({
      month,
      themes: [...counts.entries()]
        .map(([slug, count]) => ({ slug, name: nameOf(slug) ?? "", count }))
        .filter((t) => t.name && t.count > 0)
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        .slice(0, THEMES_PER_MONTH),
    }))
    .filter((m) => m.themes.length > 0);
}

/** One archetype's counts by tool, as lib/archetype-tallies.ts produces them. */
export interface ThemeTallyLike {
  slug: string;
  name: string;
  byTool: Partial<Record<string, { light: number; shadow: number; either: number }>>;
}

export interface TopTheme {
  slug: string;
  name: string;
  count: number;
}

export const HOME_THEMES = 5;

/** The shared archetypes that came up most across the tools given, every side counted, most often first (ties in name order). */
export function topThemes(tallies: ThemeTallyLike[], limit = HOME_THEMES): TopTheme[] {
  return tallies
    .map((t) => ({
      slug: t.slug,
      name: t.name,
      count: Object.values(t.byTool).reduce((sum, c) => sum + (c ? c.light + c.shadow + c.either : 0), 0),
    }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

// --- When the person reads ---

export interface SkyFields {
  moonPhase?: string;
  weekday?: string;
  wheelPrevious?: string;
  tz?: string | null;
}

export interface WhenRow {
  created_at: string;
  /** The sky saved with the reading, or null when none was saved. */
  sky: SkyFields | null;
}

export interface Tally {
  label: string;
  count: number;
}

export interface WhenCounts {
  /** All readings counted. */
  total: number;
  /** Readings with no sky saved, left out of the sky counts (the time of day, weekday, moon phase, and festival). */
  noSky: number;
  /** Readings whose saved sky has no time zone, left out of the time of day only. */
  noTimeZone: number;
  partOfDay: Tally[];
  weekday: Tally[];
  moonPhase: Tally[];
  festival: Tally[];
}

export const PARTS_OF_DAY = ["Early morning (5am to noon)", "Afternoon (noon to 5pm)", "Evening (5pm to 10pm)", "Night (10pm to 5am)"];
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const FESTIVALS = ["Yule", "Imbolc", "Ostara", "Beltane", "Litha", "Lughnasadh", "Mabon", "Samhain"];

/** The part of the day an instant fell in, in the given time zone; null when the zone is unknown or not valid. */
export function partOfDay(createdAt: string, tz: string | null | undefined): string | null {
  if (!tz) return null;
  let hour: number;
  try {
    const h = new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: tz }).format(new Date(createdAt));
    hour = Number(h);
  } catch {
    return null;
  }
  if (!Number.isInteger(hour)) return null;
  if (hour >= 5 && hour < 12) return PARTS_OF_DAY[0];
  if (hour >= 12 && hour < 17) return PARTS_OF_DAY[1];
  if (hour >= 17 && hour < 22) return PARTS_OF_DAY[2];
  return PARTS_OF_DAY[3];
}

/** Counts readings by when they were made. Each count is "how many readings", and nothing is ranked as better than another. */
export function whenCounts(rows: WhenRow[], moonOrder: string[]): WhenCounts {
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
  const parts = new Map<string, number>();
  const days = new Map<string, number>();
  const moons = new Map<string, number>();
  const fests = new Map<string, number>();
  let noSky = 0;
  let noTimeZone = 0;
  for (const r of rows) {
    if (!r.sky) {
      noSky++;
      continue;
    }
    if (r.sky.weekday) bump(days, r.sky.weekday);
    if (r.sky.moonPhase) bump(moons, r.sky.moonPhase);
    if (r.sky.wheelPrevious) bump(fests, r.sky.wheelPrevious);
    const part = partOfDay(r.created_at, r.sky.tz);
    if (part) bump(parts, part);
    else noTimeZone++;
  }
  const inOrder = (m: Map<string, number>, order: string[]): Tally[] => {
    const known = order.filter((k) => m.has(k)).map((k) => ({ label: k, count: m.get(k)! }));
    const extra = [...m.entries()].filter(([k]) => !order.includes(k)).map(([label, count]) => ({ label, count }));
    return [...known, ...extra];
  };
  return {
    total: rows.length,
    noSky,
    noTimeZone,
    partOfDay: inOrder(parts, PARTS_OF_DAY),
    weekday: inOrder(days, WEEKDAYS),
    moonPhase: inOrder(moons, moonOrder),
    festival: inOrder(fests, FESTIVALS),
  };
}
