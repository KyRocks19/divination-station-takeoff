import { query } from "./db";
import { KIND_LABELS, isItemKind } from "./days-core";

// The daily journal in the person's export (JSON and Markdown): each day's own writing and what they kept with it. A snapshot is exported with the
// words it kept; a live link is exported as its title and where it lives (the original is exported with its own tool). Only the person's own days.

export interface ExportedDayItem {
  kind: string;
  mode: string;
  title: string | null;
  /** The words a snapshot kept. Empty for a live link. */
  text: string | null;
  /** Where the original lives, if the person kept the link. */
  href: string | null;
  added_at: string;
}

export interface ExportedDay {
  day: string;
  writing: string;
  items: ExportedDayItem[];
}

/** Every day with something in it, oldest first. */
export async function collectDays(userId: number): Promise<ExportedDay[]> {
  const entries = await query<{ day: string; body: string }>("SELECT day::text AS day, body FROM day_entries WHERE user_id = $1 AND body <> '' ORDER BY day", [userId]);
  const items = await query<{ day: string; kind: string; mode: string; title: string | null; snapshot: string | null; href: string | null; created_at: string | Date }>(
    "SELECT day::text AS day, kind, mode, title, snapshot, href, created_at FROM day_items WHERE user_id = $1 ORDER BY day, id",
    [userId]
  );
  const byDay = new Map<string, ExportedDay>();
  const get = (day: string) => byDay.get(day) ?? byDay.set(day, { day, writing: "", items: [] }).get(day)!;
  for (const e of entries) get(e.day).writing = e.body;
  for (const i of items) {
    get(i.day).items.push({
      kind: i.kind,
      mode: i.mode,
      title: i.title,
      text: i.snapshot,
      href: i.href,
      added_at: i.created_at instanceof Date ? i.created_at.toISOString() : String(i.created_at),
    });
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/** The days as Markdown lines for the readable export. */
export function daysMarkdown(days: ExportedDay[]): string[] {
  if (days.length === 0) return [];
  const out: string[] = ["", "## Your days"];
  for (const d of days) {
    out.push("", `### ${d.day}`);
    if (d.writing.trim()) out.push("", d.writing.trim());
    for (const i of d.items) {
      const kind = isItemKind(i.kind) ? KIND_LABELS[i.kind] : i.kind;
      out.push("", `#### ${kind}: ${i.title || "(no title)"} (${i.mode === "snapshot" ? "snapshot" : "live link"})`);
      if (i.text) out.push("", i.text);
      if (i.href) out.push("", `Where it lives in the app: ${i.href}`);
    }
  }
  return out;
}
