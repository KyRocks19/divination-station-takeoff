"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorNote, SectionLabel } from "@/components/ui/Page";
import { FILE_NAME_RE, MAX_FILES_READ, MAX_FILE_CHARS, normalizeWriting, parseDayFile } from "@/lib/days-markdown";
import { MAX_DAY_BODY } from "@/lib/days-core";

// Keeping the days in a folder on the person's own computer. Everything with the folder happens in their browser (the File System Access API, in
// desktop Chrome and Edge): the browser asks them to pick the folder, this page only ever touches files inside it, and the server never learns
// where it is. Saving writes one .md file per day. Reading looks only at .md files in that folder named like 2026-10-14.md, reads them as plain
// text (never as HTML), and imports only the person's own writing for the day, after they have looked at each one.

interface FsFile {
  kind: "file";
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
}
interface FsDir {
  kind: "directory";
  name: string;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FsFile>;
  values(): AsyncIterable<FsFile | FsDir>;
}
type Picker = (options?: { id?: string; mode?: "read" | "readwrite" }) => Promise<FsDir>;

const getPicker = (): Picker | null => (typeof window !== "undefined" ? (window as unknown as { showDirectoryPicker?: Picker }).showDirectoryPicker ?? null : null);
const cancelled = (err: unknown) => (err as { name?: string })?.name === "AbortError";
const notFound = (err: unknown) => (err as { name?: string })?.name === "NotFoundError";

interface FilesResponse {
  files: { name: string; day: string; content: string; writing: string }[];
  capped: boolean;
}

type Choice = "skip" | "import" | "use" | "append";
interface Row {
  day: string;
  file: string;
  text: string;
  appText: string;
  status: "new" | "different" | "same";
}
interface Refused {
  name: string;
  reason: string;
}

const chars = (n: number) => `${n.toLocaleString()} character${n === 1 ? "" : "s"}`;

export default function DaysFolder() {
  const [supported, setSupported] = useState(false);
  useEffect(() => setSupported(getPicker() !== null), []);

  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSummary, setSaveSummary] = useState<string[] | null>(null);

  const [rows, setRows] = useState<Row[] | null>(null);
  const [refused, setRefused] = useState<Refused[]>([]);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [readNote, setReadNote] = useState<string | null>(null);
  const [applied, setApplied] = useState<string[] | null>(null);

  async function load(): Promise<FilesResponse | null> {
    const res = await fetch("/api/days/files").catch(() => null);
    if (!res?.ok) {
      setError("Your days could not be loaded. Try again.");
      return null;
    }
    return res.json();
  }

  async function saveToFolder() {
    const pick = getPicker();
    if (!pick) return;
    setError(null);
    setSaveSummary(null);
    // What an earlier reading of the folder found no longer applies once the folder is written to.
    setRows(null);
    setRefused([]);
    setReadNote(null);
    setApplied(null);
    let dir: FsDir;
    try {
      dir = await pick({ id: "divination-days", mode: "readwrite" });
    } catch (err) {
      if (!cancelled(err)) setError("The folder could not be opened. Your browser may have said no.");
      return;
    }
    setBusy(true);
    try {
      const data = await load();
      if (!data) return;
      let wrote = 0, unchanged = 0, failed = 0;
      const differ: string[] = [];
      for (const f of data.files) {
        if (!FILE_NAME_RE.test(f.name)) continue; // only names the app itself made are ever written
        let existing: string | null = null;
        try {
          const file = await (await dir.getFileHandle(f.name)).getFile();
          existing = file.size > MAX_FILE_CHARS * 4 ? "\u0000too big to compare" : (await file.text()).replace(/\r\n?/g, "\n");
        } catch (err) {
          if (!notFound(err)) {
            failed++;
            continue;
          }
        }
        if (existing !== null && existing === f.content) {
          unchanged++;
          continue;
        }
        if (existing !== null && !replace) {
          differ.push(f.name);
          continue;
        }
        try {
          const writer = await (await dir.getFileHandle(f.name, { create: true })).createWritable();
          await writer.write(f.content);
          await writer.close();
          wrote++;
        } catch {
          failed++;
        }
      }
      const lines = [`Saved ${wrote} new or updated file${wrote === 1 ? "" : "s"} in the folder “${dir.name}”. ${unchanged} already matched.`];
      if (differ.length > 0) {
        lines.push(
          `${differ.length} file${differ.length === 1 ? " is" : "s are"} different from the app and ${differ.length === 1 ? "was" : "were"} left alone (${differ.slice(0, 5).join(", ")}${differ.length > 5 ? ", …" : ""}). ` +
            "A file may differ because you changed it, or because you changed the day in the app. Read the folder back below to see which, or tick “Replace files that differ” and save again."
        );
      }
      if (failed > 0) lines.push(`${failed} could not be written.`);
      if (data.capped) lines.push("You have more days than fit in one go, so only the newest 2,000 were saved.");
      setSaveSummary(lines);
    } finally {
      setBusy(false);
    }
  }

  async function readFolder() {
    const pick = getPicker();
    if (!pick) return;
    setError(null);
    setSaveSummary(null);
    setRows(null);
    setApplied(null);
    setReadNote(null);
    let dir: FsDir;
    try {
      dir = await pick({ id: "divination-days", mode: "read" });
    } catch (err) {
      if (!cancelled(err)) setError("The folder could not be opened. Your browser may have said no.");
      return;
    }
    setBusy(true);
    try {
      const data = await load();
      if (!data) return;
      const appWriting = new Map(data.files.map((f) => [f.day, f.writing]));
      const found: Row[] = [];
      const bad: Refused[] = [];
      let seen = 0, ignored = 0, stopped = false;
      // Only files directly in the chosen folder, only .md files named like a day. Folders, PDFs and everything else are left alone.
      for await (const h of dir.values()) {
        if (h.kind !== "file" || !/\.md$/i.test(h.name)) {
          ignored++;
          continue;
        }
        if (!FILE_NAME_RE.test(h.name)) {
          ignored++;
          continue;
        }
        if (seen >= MAX_FILES_READ) {
          stopped = true;
          break;
        }
        seen++;
        const file = await h.getFile();
        if (file.size > MAX_FILE_CHARS * 4) {
          bad.push({ name: h.name, reason: "The file is too large to read." });
          continue;
        }
        const parsed = parseDayFile(h.name, await file.text());
        if (!parsed.ok) {
          bad.push({ name: h.name, reason: parsed.reason });
          continue;
        }
        if (!parsed.body) continue; // a day with no writing has nothing to bring in
        const app = appWriting.get(parsed.day) ?? "";
        const status = normalizeWriting(app) === parsed.body ? "same" : normalizeWriting(app) === "" ? "new" : "different";
        found.push({ day: parsed.day, file: h.name, text: parsed.body, appText: app, status });
      }
      found.sort((a, b) => b.day.localeCompare(a.day));
      setRows(found);
      setRefused(bad);
      setChoices(Object.fromEntries(found.map((r) => [r.day, r.status === "new" ? "import" : "skip"])) as Record<string, Choice>);
      setReadNote(
        `Looked at the folder “${dir.name}”: ${found.length} day file${found.length === 1 ? "" : "s"} with writing.` +
          (ignored > 0 ? ` ${ignored} other thing${ignored === 1 ? " was" : "s were"} ignored (folders, PDFs, and files not named like a day).` : "") +
          (stopped ? ` Only the first ${MAX_FILES_READ} were read.` : "")
      );
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!rows) return;
    setBusy(true);
    setError(null);
    const done: string[] = [];
    let imported = 0;
    for (const r of rows) {
      const c = choices[r.day] ?? "skip";
      if (c === "skip" || r.status === "same") continue;
      const body = c === "append" ? `${normalizeWriting(r.appText)}\n\n${r.text}` : r.text;
      if (body.length > MAX_DAY_BODY) {
        done.push(`${r.day}: not imported, the two together would be longer than ${chars(MAX_DAY_BODY)}.`);
        continue;
      }
      const res = await fetch(`/api/days/${r.day}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) }).catch(() => null);
      if (res?.ok) imported++;
      else done.push(`${r.day}: could not be saved.`);
    }
    setApplied([`Brought in ${imported} day${imported === 1 ? "" : "s"}.`, ...done]);
    setBusy(false);
    // Show what is now the same.
    setRows((rs) => (rs ? rs.map((r) => (r.status !== "same" && (choices[r.day] ?? "skip") !== "skip" && !done.some((d) => d.startsWith(r.day)) ? { ...r, status: "same" as const } : r)) : rs));
  }

  const pending = rows?.filter((r) => r.status !== "same" && (choices[r.day] ?? "skip") !== "skip").length ?? 0;

  return (
    <Card className="space-y-4" aria-labelledby="folder-heading">
      <SectionLabel id="folder-heading">A copy in a folder on this computer</SectionLabel>
      <p className="text-sm text-ink-soft">
        Keep your days as plain text files (one <code>.md</code> file per day) in a folder you choose, so they are yours outside this app too. Your browser does the
        saving and reading; this site never learns where the folder is.
      </p>

      {supported ? (
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <Button disabled={busy} onClick={saveToFolder}>{busy ? "Working…" : "Choose a folder and save my days"}</Button>
              {/* A file to download, not a page, so a plain link (next/link would try to open it as a page). */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/api/days/zip" className="text-xs text-accent-ink underline">or download a zip instead</a>
            </div>
            <label className="flex items-start gap-2 text-xs text-ink-faint cursor-pointer">
              <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} className="accent-tone-600 mt-0.5" />
              <span>Replace files that differ. Off by default, so a file you changed yourself is never overwritten. If you turn it on, the folder&rsquo;s version of those files is lost.</span>
            </label>
            {saveSummary && (
              <div role="status" className="text-sm text-ink-soft space-y-1">
                {saveSummary.map((l) => <p key={l}>{l}</p>)}
              </div>
            )}
          </div>

          <div className="space-y-2 border-t border-line-faint pt-3">
            <p className="text-xs text-ink-faint">
              Changed a file, or have days written elsewhere? Read the folder back. Only <code>.md</code> files named like <code>2026-10-14.md</code> are looked at, as plain
              text, and you decide what comes in; nothing changes until you press the button below.
            </p>
            <Button variant="quiet" disabled={busy} onClick={readFolder}>Read days back from a folder</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-ink-muted">
            This browser cannot save into a folder (that works in Chrome and Edge on a computer). You can download everything as a zip of the same files instead.
          </p>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/api/days/zip" className="inline-block text-sm text-accent-ink underline">Download my days as a zip</a>
        </div>
      )}

      {error && <ErrorNote>{error}</ErrorNote>}

      {readNote && <p role="status" className="text-sm text-ink-soft">{readNote}</p>}
      {rows && rows.length > 0 && (
        <div className="space-y-3">
          <ul className="space-y-3 list-none p-0">
            {rows.map((r) => (
              <li key={r.day} className="border border-line rounded-control p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-ink-strong">
                    {r.file}
                    <span className="ml-2 text-xs font-normal text-ink-faint">
                      {r.status === "new" ? "Nothing written for this day in the app yet" : r.status === "same" ? "Same as the app" : "Different from what the app holds"}
                    </span>
                  </p>
                  {r.status !== "same" && (
                    <select
                      aria-label={`What to do with ${r.file}`}
                      value={choices[r.day] ?? "skip"}
                      onChange={(e) => setChoices({ ...choices, [r.day]: e.target.value as Choice })}
                      className="bg-field border border-line-strong rounded-control px-2 py-1 text-xs text-ink-strong"
                    >
                      <option value="skip">Leave it</option>
                      {r.status === "new" ? (
                        <option value="import">Bring it in</option>
                      ) : (
                        <>
                          <option value="use">Use the file&rsquo;s text (replaces the app&rsquo;s)</option>
                          <option value="append">Add the file&rsquo;s text below the app&rsquo;s</option>
                        </>
                      )}
                    </select>
                  )}
                </div>
                <details>
                  <summary className="text-xs text-accent-ink cursor-pointer">Show the text ({chars(r.text.length)}{r.status === "different" ? ", and the app’s" : ""})</summary>
                  <p className="text-xs text-ink-ghost mt-2">In the file:</p>
                  <pre className="whitespace-pre-wrap break-words text-xs text-ink-soft bg-field border border-line rounded-control p-2 font-sans max-h-60 overflow-auto">{r.text}</pre>
                  {r.status === "different" && (
                    <>
                      <p className="text-xs text-ink-ghost mt-2">In the app:</p>
                      <pre className="whitespace-pre-wrap break-words text-xs text-ink-soft bg-field border border-line rounded-control p-2 font-sans max-h-60 overflow-auto">{r.appText}</pre>
                    </>
                  )}
                </details>
              </li>
            ))}
          </ul>
          <Button disabled={busy || pending === 0} onClick={apply}>{busy ? "Working…" : pending === 0 ? "Nothing chosen to bring in" : `Bring in ${pending} chosen`}</Button>
        </div>
      )}
      {refused.length > 0 && (
        <details>
          <summary className="text-xs text-ink-faint cursor-pointer">{refused.length} file{refused.length === 1 ? "" : "s"} could not be read</summary>
          <ul className="text-xs text-ink-faint list-disc pl-5 mt-1 space-y-0.5">
            {refused.map((f) => <li key={f.name}>{f.name}: {f.reason}</li>)}
          </ul>
        </details>
      )}
      {applied && (
        <div role="status" className="text-sm text-ink-soft space-y-1">
          {applied.map((l) => <p key={l}>{l}</p>)}
        </div>
      )}

      <p className="text-xs text-ink-ghost border-t border-line-faint pt-3">
        Deleting a day or something kept with it in the app does not delete a file already in your folder, and deleting a file from the folder does not delete the day
        in the app. A folder is only as private as the account on the computer it is on.
      </p>
    </Card>
  );
}
