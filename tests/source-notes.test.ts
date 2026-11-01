import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SOURCE_NOTE_MAX, cleanSourceNote, isNotableSource } from "../lib/source-notes-core";

test("a note can go on a primary, a secondary or a tool source, and nowhere else", () => {
  assert.ok(isNotableSource("radin"));
  assert.ok(isNotableSource("penrose"));
  assert.ok(isNotableSource("decker-dummett-2002"));
  assert.ok(!isNotableSource("nope"));
  assert.ok(!isNotableSource(42));
});

test("a note is trimmed, an empty one means remove, and a long one is refused", () => {
  assert.deepEqual(cleanSourceNote({ sourceId: "radin", note: "  read twice \r\n" }), { ok: true, sourceId: "radin", note: "read twice" });
  assert.deepEqual(cleanSourceNote({ sourceId: "radin", note: "   " }), { ok: true, sourceId: "radin", note: "" });
  assert.equal(cleanSourceNote({ sourceId: "radin", note: "x".repeat(SOURCE_NOTE_MAX + 1) }).ok, false);
  assert.equal(cleanSourceNote({ sourceId: "radin" }).ok, false);
  assert.equal(cleanSourceNote({ sourceId: "unknown", note: "hi" }).ok, false);
  assert.equal(cleanSourceNote(null).ok, false);
});

test("only an admin can save a note, and each change is logged", () => {
  const route = readFileSync(new URL("../app/api/source-notes/route.ts", import.meta.url), "utf8");
  assert.match(route, /if \(!session\.userId\) return Response\.json\(\{ error: "Unauthorized" \}, \{ status: 401 \}\)/);
  assert.match(route, /if \(!session\.isAdmin\)[^\n]*status: 403/);
  assert.match(route, /logAdminAction\(session, "source_note_changed"/);
});

test("the migration is idempotent and keeps a note when its writer's account goes", () => {
  const sql = readFileSync(new URL("../migrations/097_source_notes.sql", import.meta.url), "utf8");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS source_notes/);
  assert.match(sql, /REFERENCES users\(id\) ON DELETE SET NULL/);
});
