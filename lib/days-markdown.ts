import { KIND_LABELS, MAX_DAY_BODY, isItemKind, isValidDay } from "./days-core";

// The daily journal as Markdown files in a folder on the person's own computer. Written by their own browser (or downloaded as a zip) and read back
// by it. Browser-safe and pure: no database, no file access here. Reading files back is deliberately strict, because a file in a folder is not
// something the app made: only text is read, only the person's own writing for a day is taken, nothing is rendered as HTML, and nothing is run.

export const FILE_NAME_RE = /^\d{4}-\d{2}-\d{2}\.md$/;
/** A file bigger than this is not read (the app's own files are far smaller: a day's writing is at most 20,000 characters). */
export const MAX_FILE_CHARS = 200_000;
/** The most files read from a folder at once. */
export const MAX_FILES_READ = 400;
/** The line that ends the person's own writing in a file and starts what was kept with the day. Invisible in most Markdown viewers. */
export const KEPT_MARKER = "<!-- kept-with-this-day -->";

export interface DayFileItem {
  kind: string;
  mode: "snapshot" | "link";
  title: string;
  /** The words: what a snapshot kept, or for a live link the version at the time of saving. */
  text: string;
  /** Where it lives in the app, if the person kept the link. */
  href: string | null;
  /** The original has been deleted. */
  gone: boolean;
}

export interface DayFile {
  day: string;
  writing: string;
  items: DayFileItem[];
}

export const fileNameFor = (day: string) => `${day}.md`;

const longDate = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

/** One day as the text of its file: a small header, the person's writing, and (after an invisible marker) what they kept with the day. */
export function dayToMarkdown(d: DayFile): string {
  // The marker is the one line the reader looks for, so it cannot appear inside the person's own writing.
  const writing = d.writing.replaceAll(KEPT_MARKER, KEPT_MARKER.replace("-->", "(escaped) -->")).trim();
  const out = ["---", "source: Divination Station", `day: ${d.day}`, "---", "", `# ${longDate(d.day)}`, "", writing];
  if (d.items.length > 0) {
    out.push("", KEPT_MARKER, "## Kept with this day");
    for (const i of d.items) {
      const kind = isItemKind(i.kind) ? KIND_LABELS[i.kind] : i.kind;
      out.push("", `### ${kind}: ${i.title || "(no title)"} (${i.mode === "snapshot" ? "snapshot" : "live link, as it was when saved"})`);
      if (i.gone) out.push("", "_The original has been deleted._");
      if (i.text.trim()) out.push("", i.text.trim());
      if (i.href) out.push("", `Where it lives in the app: ${i.href}`);
    }
  }
  return out.join("\n") + "\n";
}

export type ParsedDayFile = { ok: true; day: string; body: string } | { ok: false; reason: string };

/** Header lines look like `key: value` and nothing else; anything else at the top of a file is the person's own text, not a header. */
const isFrontMatter = (lines: string[]) => lines.length > 0 && lines.every((l) => l.trim() === "" || /^[A-Za-z_][\w-]*:(\s.*)?$/.test(l));

/**
 * Takes the person's own writing for a day out of a file's text. The file's name says the day. The app's own header and the part after the
 * "kept with this day" marker are left out; a file someone else wrote (no app header) is read as plain writing from its first line.
 */
export function parseDayFile(fileName: string, text: string, now = new Date()): ParsedDayFile {
  if (!FILE_NAME_RE.test(fileName)) return { ok: false, reason: "The name is not a date like 2026-10-14.md." };
  const day = fileName.slice(0, 10);
  if (!isValidDay(day, now)) return { ok: false, reason: "That is not a day I can use." };
  if (text.length > MAX_FILE_CHARS) return { ok: false, reason: "The file is too large to read." };

  let t = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  let appMade = false;
  if (t.startsWith("---\n")) {
    const end = t.indexOf("\n---\n", 3);
    const endsFile = t.endsWith("\n---");
    const stop = end >= 0 ? end : endsFile ? t.length - 4 : -1;
    if (stop > 0) {
      const front = t.slice(4, stop).split("\n");
      if (isFrontMatter(front)) {
        appMade = front.some((l) => /^source:\s*Divination Station\s*$/.test(l));
        t = end >= 0 ? t.slice(end + 5) : "";
      }
    }
  }
  const marker = t.indexOf(KEPT_MARKER);
  if (marker >= 0) t = t.slice(0, marker);
  // The app's own title line is not the person's writing. In a file the app did not make, every line is.
  if (appMade) t = t.replace(/^\s*# [^\n]*(\n|$)/, "");
  const body = t.trim();
  if (body.length > MAX_DAY_BODY) return { ok: false, reason: `Too long: a day's writing can be ${MAX_DAY_BODY.toLocaleString()} characters at most.` };
  return { ok: true, day, body };
}

/** The same writing, for comparing a file with what the app holds (line endings and the ends of the text do not count as a difference). */
export const normalizeWriting = (s: string) => s.replace(/\r\n?/g, "\n").trim();
