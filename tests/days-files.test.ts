import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { crc32 as nodeCrc32 } from "node:zlib";
import { crc32, zipStore } from "../lib/zip";
import { FILE_NAME_RE, KEPT_MARKER, MAX_FILE_CHARS, dayToMarkdown, fileNameFor, normalizeWriting, parseDayFile, type DayFile } from "../lib/days-markdown";
import { MAX_DAY_BODY } from "../lib/days-core";

const NOW = new Date("2026-10-14T12:00:00Z");
const day = (writing: string, items: DayFile["items"] = []): DayFile => ({ day: "2026-10-14", writing, items });
const item = (over: Partial<DayFile["items"][number]> = {}): DayFile["items"][number] => ({ kind: "reading", mode: "snapshot", title: "Runes: Fehu", text: "What came up: Fehu", href: "/runes/1", gone: false, ...over });

// --- the zip ---

test("the zip's checksum matches node's own, and the archive has the structure a zip reader expects", () => {
  const data = new TextEncoder().encode("hello days");
  assert.equal(crc32(data), nodeCrc32(Buffer.from(data)));
  const zip = zipStore([{ name: "2026-10-14.md", data }, { name: "2026-10-15.md", data: new TextEncoder().encode("é ünïcode") }], NOW);
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  assert.equal(v.getUint32(0, true), 0x04034b50, "starts with a local header");
  const end = zip.length - 22;
  assert.equal(v.getUint32(end, true), 0x06054b50, "ends with the end record");
  assert.equal(v.getUint16(end + 10, true), 2, "two entries");
  const cdOffset = v.getUint32(end + 16, true);
  assert.equal(v.getUint32(cdOffset, true), 0x02014b50, "the directory starts where the end record says");
  // Each stored file can be found again from its local header and checked against the checksum in the directory.
  let at = 0;
  for (let i = 0; i < 2; i++) {
    assert.equal(v.getUint32(at, true), 0x04034b50);
    const crc = v.getUint32(at + 14, true);
    const size = v.getUint32(at + 18, true);
    const nameLen = v.getUint16(at + 26, true);
    const body = zip.subarray(at + 30 + nameLen, at + 30 + nameLen + size);
    assert.equal(crc32(body), crc);
    at += 30 + nameLen + size;
  }
  assert.equal(at, cdOffset);
});

test("a zip refuses names that are not plain file names", () => {
  const d = new Uint8Array(1);
  for (const name of ["../x.md", "a/b.md", "a\\b.md", "", ".hidden", "x".repeat(200) + ".md", "C:evil.md", "..", "a..b.md"]) {
    assert.throws(() => zipStore([{ name, data: d }]), /not a safe file name/, name);
  }
  assert.doesNotThrow(() => zipStore([{ name: "2026-10-14.md", data: d }]));
});

// --- writing a file and reading it back ---

test("a day's writing survives being written to a file and read back, whatever is in it", () => {
  const samples = [
    "A quiet day. Rain.",
    "# A heading of my own\n\nWith **bold**, a list:\n- one\n- two\n\n> and a quote",
    "---\nnot a header, just a rule\n---\nafter",
    "Line one\r\nLine two with CRLF",
    "emoji 🌙 and accents é ü, and <script>alert(1)</script> as plain words",
    "## Kept with this day\n(the person's own words that happen to look like my heading)",
    "",
  ];
  for (const w of samples) {
    const file = dayToMarkdown(day(w, [item()]));
    const back = parseDayFile("2026-10-14.md", file, NOW);
    assert.ok(back.ok, `parses: ${JSON.stringify(w).slice(0, 40)}`);
    if (back.ok) assert.equal(back.body, normalizeWriting(w), `round trip: ${JSON.stringify(w).slice(0, 40)}`);
  }
});

test("what was kept with the day is in the file but is never read back as the person's writing", () => {
  const file = dayToMarkdown(day("My words.", [item({ title: "Questions, written by Ember, an AI", text: "1. A question?" }), item({ mode: "link", gone: true, text: "", href: null })]));
  assert.match(file, /^---\nsource: Divination Station\nday: 2026-10-14\n---\n\n# Wednesday, October 14, 2026\n\nMy words\./);
  assert.ok(file.includes(KEPT_MARKER));
  assert.match(file, /### Reading: Questions, written by Ember, an AI \(snapshot\)/);
  assert.match(file, /### Reading: Runes: Fehu \(live link, as it was when saved\)/);
  assert.match(file, /_The original has been deleted\._/);
  assert.match(file, /Where it lives in the app: \/runes\/1/);
  const back = parseDayFile("2026-10-14.md", file, NOW);
  assert.ok(back.ok && back.body === "My words.");
  assert.ok(!file.includes("undefined"));
  // A day with nothing kept has no marker section at all.
  assert.ok(!dayToMarkdown(day("Only words.")).includes(KEPT_MARKER));
});

test("the person's own writing cannot contain the marker the reader looks for", () => {
  const sneaky = `Before\n${KEPT_MARKER}\nAfter the marker`;
  const back = parseDayFile("2026-10-14.md", dayToMarkdown(day(sneaky, [item()])), NOW);
  assert.ok(back.ok);
  if (back.ok) {
    assert.match(back.body, /Before/);
    assert.match(back.body, /After the marker/);
  }
});

test("a file someone else wrote is read as plain writing from its first line, with a real header removed only when it looks like one", () => {
  const plain = parseDayFile("2026-10-14.md", "# My own title\n\nMy day in my own file.", NOW);
  assert.ok(plain.ok && plain.body === "# My own title\n\nMy day in my own file.");
  const withHeader = parseDayFile("2026-10-14.md", "---\ntags: journal\n---\n# Kept\nText", NOW);
  assert.ok(withHeader.ok && withHeader.body === "# Kept\nText", "an unknown header goes, but the title is kept (it is not the app's)");
  const rule = parseDayFile("2026-10-14.md", "---\nthis is a sentence, not a key\n---\nbody", NOW);
  assert.ok(rule.ok && rule.body.startsWith("---"), "a rule between two lines is not a header");
  const bom = parseDayFile("2026-10-14.md", "﻿With a byte order mark", NOW);
  assert.ok(bom.ok && bom.body === "With a byte order mark");
});

test("files that are not a day, too large, or too long are refused with a reason, and nothing is guessed", () => {
  assert.equal(FILE_NAME_RE.test("2026-10-14.md"), true);
  for (const name of ["notes.md", "2026-10-14.txt", "2026-10-14.md.exe", "../2026-10-14.md", "2026-10-14.pdf", "2026-1-4.md", "x2026-10-14.md"]) {
    const r = parseDayFile(name, "text", NOW);
    assert.equal(r.ok, false, name);
  }
  assert.equal(parseDayFile("2026-02-30.md", "x", NOW).ok, false);
  assert.equal(parseDayFile("2040-01-01.md", "x", NOW).ok, false);
  const big = parseDayFile("2026-10-14.md", "x".repeat(MAX_FILE_CHARS + 1), NOW);
  assert.ok(!big.ok && /too large/.test(big.reason));
  const long = parseDayFile("2026-10-14.md", "x".repeat(MAX_DAY_BODY + 1), NOW);
  assert.ok(!long.ok && /Too long/.test(long.reason));
  assert.equal(fileNameFor("2026-10-14"), "2026-10-14.md");
});

test("the folder pieces that run in the browser import no database code", () => {
  for (const f of ["components/DaysFolder.tsx", "lib/days-markdown.ts", "lib/zip.ts"]) {
    const imports = readFileSync(f, "utf8").split("\n").filter((l) => l.startsWith("import ") && !l.startsWith("import type"));
    assert.ok(!imports.some((l) => /lib\/(days|db)"|\/db"|"pg"/.test(l)), `${f} imports no database code`);
  }
});
