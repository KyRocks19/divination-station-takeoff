import { query, queryOne } from "./db";
import { DIVINATION_KIND_LABELS, divinationPath, type DivinationKind } from "./divination-kinds";
import { localDay, tzOfSky } from "./days-core";
import { daysInMonth, parseWheel, readingFromPath, topReading, type CalendarDay, type WheelChoices } from "./calendar-core";

// The calendar's queries (lib/calendar-core.ts has the rules). Every query is for one person; nothing here is shown to anyone else.
// Migration 104 adds divinations.views and users.wheel_calendar (on live since 2026-10-30).

const toIso = (d: string | Date) => (d instanceof Date ? d.toISOString() : new Date(d).toISOString());

export async function getWheel(userId: number): Promise<WheelChoices> {
  const row = await queryOne<{ wheel_calendar: string | null }>("SELECT wheel_calendar FROM users WHERE id = $1", [userId]);
  return parseWheel(row?.wheel_calendar ?? null);
}

/** Saves the person's festival choices. */
export async function saveWheel(userId: number, choices: WheelChoices): Promise<void> {
  await query("UPDATE users SET wheel_calendar = $2 WHERE id = $1", [userId, JSON.stringify(choices)]);
}

type ReadingRow = { id: number; kind: DivinationKind; summary: string; reading_id: number | null; created_at: string | Date; sky: string | null; views: number };

async function readingsBetween(userId: number, from: Date, to: Date): Promise<ReadingRow[]> {
  return query<ReadingRow>(
    `SELECT id, kind, summary, reading_id, created_at, sky, views FROM divinations
      WHERE user_id = $1 AND created_at >= $2 AND created_at < $3 ORDER BY created_at, id LIMIT 5000`,
    [userId, from, to]
  );
}

/** Every day of a month that has something in it, with its summary. `listReadings` follows the person's setting for listing readings on days. */
export async function monthDays(userId: number, month: string, listReadings: boolean): Promise<CalendarDay[]> {
  const first = `${month}-01`;
  const last = `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
  const byDay = new Map<string, CalendarDay>();
  const get = (day: string) => {
    let d = byDay.get(day);
    if (!d) byDay.set(day, (d = { day, readings: 0, tools: [], top: null, snippet: "", items: 0 }));
    return d;
  };

  if (listReadings) {
    // A reading's day is its date in the time zone saved with it, so the window is wide enough for every zone and each row is placed here.
    const [y, m] = month.split("-").map(Number);
    const from = new Date(Date.UTC(y, m - 1, 1) - 14 * 3_600_000);
    const to = new Date(Date.UTC(y, m, 1) + 36 * 3_600_000);
    const grouped = new Map<string, (ReadingRow & { at: string })[]>();
    for (const r of await readingsBetween(userId, from, to)) {
      const at = toIso(r.created_at);
      const day = localDay(at, tzOfSky(r.sky));
      if (day < first || day > last) continue;
      grouped.set(day, [...(grouped.get(day) ?? []), { ...r, at, views: Number(r.views) || 0 }]);
    }
    for (const [day, list] of grouped) {
      const d = get(day);
      d.readings = list.length;
      d.tools = [...new Set(list.map((r) => DIVINATION_KIND_LABELS[r.kind] ?? r.kind))];
      const top = topReading(list)!;
      d.top = { label: DIVINATION_KIND_LABELS[top.kind] ?? top.kind, summary: top.summary.trim().slice(0, 140), href: divinationPath(top.kind, top.id, top.reading_id), views: top.views };
    }
  }

  const entries = await query<{ day: string; snippet: string }>(
    "SELECT day::text AS day, left(body, 140) AS snippet FROM day_entries WHERE user_id = $1 AND body <> '' AND day >= $2::date AND day <= $3::date",
    [userId, first, last]
  );
  for (const e of entries) get(e.day).snippet = e.snippet.trim();
  const items = await query<{ day: string; n: number }>(
    "SELECT day::text AS day, COUNT(*)::int AS n FROM day_items WHERE user_id = $1 AND day >= $2::date AND day <= $3::date GROUP BY day",
    [userId, first, last]
  );
  for (const i of items) get(i.day).items = i.n;

  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/** Counts one opening of one of the person's own readings, from the address of its page. Other addresses, and other people's readings, count nothing. */
export async function noteView(userId: number, path: string): Promise<boolean> {
  const r = readingFromPath(path);
  if (!r) return false;
  const rows =
    r.by === "reading"
      ? await query("UPDATE divinations SET views = views + 1 WHERE user_id = $1 AND kind = 'tarot' AND reading_id = $2 RETURNING id", [userId, r.id])
      : await query("UPDATE divinations SET views = views + 1 WHERE user_id = $1 AND kind = $2 AND id = $3 RETURNING id", [userId, r.kind, r.id]);
  return rows.length > 0;
}
