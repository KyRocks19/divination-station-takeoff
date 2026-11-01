import { getDay, listDays } from "./days";
import { dayToMarkdown, fileNameFor, type DayFile } from "./days-markdown";
import { zipStore } from "./zip";

// The person's days as Markdown files (for the folder on their own computer, or a zip download). Every file is built from their own days only, and the
// server never learns where a folder is: it only hands over names and text. See lib/days-markdown.ts for the format and lib/zip.ts for the archive.

/** The most days put in files at once (the folder button and the zip). A person with more is told; the newest are included. */
export const MAX_DAYS_IN_FILES = 2000;

export interface DayFileOut {
  name: string;
  day: string;
  /** The whole file, as it would be saved. */
  content: string;
  /** Just the person's own writing for the day, so the page can compare a file in a folder with what the app holds. */
  writing: string;
}

export async function collectDayFiles(userId: number): Promise<{ files: DayFileOut[]; capped: boolean }> {
  const listing = await listDays(userId, MAX_DAYS_IN_FILES + 1);
  const capped = listing.length > MAX_DAYS_IN_FILES;
  const days = listing.slice(0, MAX_DAYS_IN_FILES).map((d) => d.day);
  const files: DayFileOut[] = [];
  for (let i = 0; i < days.length; i += 20) {
    const chunk = await Promise.all(days.slice(i, i + 20).map((d) => getDay(userId, d, false)));
    for (const v of chunk) {
      const file: DayFile = {
        day: v.day,
        writing: v.body,
        items: v.items.map((it) => ({
          kind: it.kind,
          mode: it.mode,
          title: it.title,
          // A live link whose original is gone has nothing to show.
          text: it.mode === "link" && it.originGone ? "" : it.text,
          href: it.href,
          gone: it.originGone,
        })),
      };
      files.push({ name: fileNameFor(v.day), day: v.day, content: dayToMarkdown(file), writing: v.body });
    }
  }
  return { files, capped };
}

/** The same files as one zip archive. */
export async function zipOfDays(userId: number): Promise<{ bytes: Uint8Array; count: number }> {
  const { files } = await collectDayFiles(userId);
  const enc = new TextEncoder();
  return { bytes: zipStore(files.map((f) => ({ name: f.name, data: enc.encode(f.content) }))), count: files.length };
}
