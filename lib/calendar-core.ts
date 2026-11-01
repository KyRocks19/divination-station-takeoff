// The calendar of days (owner's request, 2026-10-30): a month at a time, each day with its moon, any Wheel of the Year festival the person keeps,
// and a short summary of what they did that day. Pure: no database here, so the calendar in the browser and the tests can use it. The queries are
// in lib/calendar.ts.

import { DIVINATION_KINDS, divinationPath, type DivinationKind } from "./divination-kinds";
import { WHEEL_DATES, WHEEL_NAMES, skyAt, type Hemisphere } from "./sky";

/** A month is written YYYY-MM. */
export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export const isValidMonth = (m: unknown): m is string => typeof m === "string" && MONTH_RE.test(m) && Number(m.slice(0, 4)) >= 2000 && Number(m.slice(0, 4)) <= 2200;

/** The month before or after, as YYYY-MM. */
export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}

export const daysInMonth = (month: string): number => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

/** The cells of a month laid out in weeks from Sunday: null for the blanks before the 1st and after the last day. */
export function monthGrid(month: string): (string | null)[] {
  const [y, m] = month.split("-").map(Number);
  const lead = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= daysInMonth(month); d++) cells.push(`${month}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** The moon on a day (at noon UTC): its phase name and picture. */
export function moonOn(day: string): { phase: string; symbol: string } {
  const sky = skyAt(new Date(`${day}T12:00:00Z`));
  return { phase: sky.moonPhase, symbol: sky.moonSymbol };
}

// --- The Wheel of the Year, as the person keeps it ---

/** A month and day, written MM-DD. */
export const MONTH_DAY_RE = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const MAX_OWN_FESTIVALS = 40;
export const MAX_FESTIVAL_NAME = 60;

export interface OwnFestival {
  id: string;
  name: string;
  /** MM-DD, every year. */
  date: string;
}

/** What the person changed about the festivals shown on their calendar. Nothing changed shows the usual eight. */
export interface WheelChoices {
  /** The usual festivals (by id) they took off. */
  hidden: string[];
  /** Their own name for a usual festival, by id. */
  names: Record<string, string>;
  /** Their own date (MM-DD) for a usual festival, by id. */
  dates: Record<string, string>;
  /** Days they added themselves. */
  own: OwnFestival[];
}

export const EMPTY_WHEEL: WheelChoices = { hidden: [], names: {}, dates: {}, own: [] };

/** The id of one of the usual eight: its name in lower case ("samhain"). */
export const WHEEL_IDS = WHEEL_NAMES.map((n) => n.toLowerCase());

export interface Festival {
  id: string;
  name: string;
  /** The usual name, when the person renamed it. */
  usualName: string | null;
  /** MM-DD */
  date: string;
  /** The usual date in the person's half of the world (MM-DD). */
  usualDate: string | null;
  own: boolean;
  hidden: boolean;
}

const md = (m: number, d: number) => `${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** The usual eight, on their dates for the person's half of the world (the south keeps each festival six months on, as lib/sky.ts does). */
export function usualFestivals(hemisphere: Hemisphere): { id: string; name: string; date: string }[] {
  return WHEEL_NAMES.map((name, i) => {
    const slot = hemisphere === "south" ? (i + 4) % 8 : i;
    const [m, d] = WHEEL_DATES[slot];
    return { id: name.toLowerCase(), name, date: md(m, d) };
  }).sort((a, b) => a.date.localeCompare(b.date));
}

/** Every festival, usual and own, with the person's changes applied, in date order. Hidden ones are included and marked, for the settings. */
export function festivalsFor(choices: WheelChoices, hemisphere: Hemisphere): Festival[] {
  const usual: Festival[] = usualFestivals(hemisphere).map((f) => ({
    id: f.id,
    name: choices.names[f.id] ?? f.name,
    usualName: choices.names[f.id] ? f.name : null,
    date: choices.dates[f.id] ?? f.date,
    usualDate: choices.dates[f.id] ? f.date : null,
    own: false,
    hidden: choices.hidden.includes(f.id),
  }));
  const own: Festival[] = choices.own.map((o) => ({ id: o.id, name: o.name, usualName: null, date: o.date, usualDate: null, own: true, hidden: false }));
  return [...usual, ...own].sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

/** The festivals shown on each day of a month, by YYYY-MM-DD. A 29 February festival shows only in a leap year. */
export function festivalsInMonth(month: string, festivals: Festival[]): Map<string, Festival[]> {
  const out = new Map<string, Festival[]>();
  const mm = month.slice(5, 7);
  const last = daysInMonth(month);
  for (const f of festivals) {
    if (f.hidden || f.date.slice(0, 2) !== mm || Number(f.date.slice(3)) > last) continue;
    const day = `${month}-${f.date.slice(3)}`;
    out.set(day, [...(out.get(day) ?? []), f]);
  }
  return out;
}

/** The next festival shown, from a day (YYYY-MM-DD) on: that day itself counts, at 0 days away. Null when every festival is hidden. */
export function nextFestival(festivals: Festival[], day: string): { festival: Festival; inDays: number } | null {
  const [y, m, d] = day.split("-").map(Number);
  const from = Date.UTC(y, m - 1, d);
  let best: { festival: Festival; inDays: number } | null = null;
  for (const f of festivals) {
    if (f.hidden) continue;
    const [fm, fd] = f.date.split("-").map(Number);
    for (const year of [y, y + 1]) {
      const at = Date.UTC(year, fm - 1, fd);
      // 29 February in a year without one rolls into March in Date.UTC; skip it.
      if (new Date(at).getUTCMonth() !== fm - 1 || at < from) continue;
      const inDays = Math.round((at - from) / 86_400_000);
      if (!best || inDays < best.inDays) best = { festival: f, inDays };
      break;
    }
  }
  return best;
}

const cleanName =(v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const s = v.replace(/\s+/g, " ").trim();
  return s ? s.slice(0, MAX_FESTIVAL_NAME) : null;
};

/** Reads saved or sent choices, keeping only what makes sense: unknown ids, bad dates and empty names are dropped. Never throws. */
export function parseWheel(raw: unknown): WheelChoices {
  let v: unknown = raw;
  if (typeof raw === "string") {
    try {
      v = JSON.parse(raw);
    } catch {
      return EMPTY_WHEEL;
    }
  }
  if (!v || typeof v !== "object") return EMPTY_WHEEL;
  const o = v as Record<string, unknown>;
  const hidden = Array.isArray(o.hidden) ? [...new Set(o.hidden.filter((id): id is string => WHEEL_IDS.includes(id as string)))] : [];
  const names: Record<string, string> = {};
  const dates: Record<string, string> = {};
  for (const id of WHEEL_IDS) {
    const n = cleanName((o.names as Record<string, unknown> | undefined)?.[id]);
    if (n) names[id] = n;
    const d = (o.dates as Record<string, unknown> | undefined)?.[id];
    if (typeof d === "string" && MONTH_DAY_RE.test(d)) dates[id] = d;
  }
  const own: OwnFestival[] = [];
  const seen = new Set<string>();
  for (const f of Array.isArray(o.own) ? o.own : []) {
    const name = cleanName(f?.name);
    const id = typeof f?.id === "string" && /^[a-z0-9-]{1,40}$/.test(f.id) && !WHEEL_IDS.includes(f.id) ? f.id : null;
    if (!name || !id || seen.has(id) || typeof f?.date !== "string" || !MONTH_DAY_RE.test(f.date)) continue;
    seen.add(id);
    own.push({ id, name, date: f.date });
    if (own.length >= MAX_OWN_FESTIVALS) break;
  }
  return { hidden, names, dates, own };
}

// --- A day's summary ---

/** One day on the calendar: what the person did, briefly. */
export interface CalendarDay {
  day: string;
  /** How many readings were made that day (0 when listing readings is switched off). */
  readings: number;
  /** The tools used, by name, each once. */
  tools: string[];
  /** The reading from that day the person opened most often, or the first one when none was opened again. */
  top: { label: string; summary: string; href: string; views: number } | null;
  /** The start of their own writing for the day, when there is some. */
  snippet: string;
  /** How many things are kept with the day. */
  items: number;
}

/** The words for a day's summary, as a screen reader hears them inside the day's link (the picture on hover shows the same). */
export function daySummaryText(d: CalendarDay | undefined, festivals: Festival[], moon: string): string {
  const parts = [moon];
  if (festivals.length) parts.push(festivals.map((f) => f.name).join(", "));
  if (!d) return parts.join(". ");
  if (d.readings) parts.push(`${d.readings} ${d.readings === 1 ? "reading" : "readings"}`);
  if (d.top) parts.push(`${d.top.views > 1 ? "Opened most" : "Reading"}: ${d.top.label}${d.top.summary ? `, ${d.top.summary}` : ""}`);
  if (d.snippet) parts.push("You wrote that day");
  if (d.items) parts.push(`${d.items} kept`);
  return parts.join(". ");
}

/** Picks the reading shown for a day: the one opened most, then the earliest. */
export function topReading<T extends { views: number; at: string }>(list: T[]): T | null {
  return [...list].sort((a, b) => b.views - a.views || a.at.localeCompare(b.at))[0] ?? null;
}

// --- Counting how often a reading is opened ---

/**
 * Which of the person's readings an address in the app is the page of, or null for any other page. The reverse of divinationPath: a tarot reading
 * is found by its tarot id (`reading`), every other tool by its shared record's id (`divination`).
 */
export function readingFromPath(path: string): { kind: DivinationKind; id: number; by: "reading" | "divination" } | null {
  const m = /^\/([a-z]+)(?:\/(pulls))?\/(\d{1,12})\/?$/.exec(path.split(/[?#]/)[0]);
  if (!m) return null;
  const id = Number(m[3]);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  if (m[1] === "readings" && !m[2]) return { kind: "tarot", id, by: "reading" };
  if (m[1] === "oracle" && m[2]) return { kind: "oracle", id, by: "divination" };
  if (m[2]) return null;
  const kind = DIVINATION_KINDS.find((k) => k !== "tarot" && k !== "oracle" && divinationPath(k, id) === `/${m[1]}/${id}`);
  return kind ? { kind, id, by: "divination" } : null;
}
