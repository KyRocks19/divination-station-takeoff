import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STAVES } from "../lib/ogham-data";
import { staveTitle } from "../lib/stave-names-core";
import { getSource, CITES } from "../lib/sources";
import { ownMarkdown, shapeOwnExport } from "../lib/export-own-core";

const forfeda = STAVES.filter((s) => s.aicme === 0);

test("a stave goes by its medieval name unless the person gave it one; the later name only when asked", () => {
  assert.deepEqual(staveTitle("ogham-eabhadh", null, false), { name: "Éabhadh", medieval: null, later: null });
  assert.deepEqual(staveTitle("ogham-eabhadh", null, true), { name: "Éabhadh", medieval: null, later: "Koad, the grove" });
  assert.deepEqual(staveTitle("ogham-eabhadh", "  the grove gate ", true), { name: "the grove gate", medieval: "Éabhadh", later: "Koad, the grove" });
  assert.deepEqual(staveTitle("ogham-eabhadh", "Éabhadh", false), { name: "Éabhadh", medieval: null, later: null }, "an own name equal to the medieval one is not shown twice");
  assert.deepEqual(staveTitle("ogham-beith", null, true), { name: "Beith", medieval: null, later: null }, "the main twenty have no later name");
});

test("each later letter has a later name, the word-ogham, a shared modern line and credited readings", () => {
  assert.equal(forfeda.length, 5);
  assert.deepEqual(forfeda.map((s) => s.laterName?.name), ["Koad", "Oir", "Uilleand", "Phagos", "Mor"]);
  for (const s of forfeda) {
    assert.ok(s.kennings && s.modern, s.id);
    assert.ok((s.voices?.length ?? 0) >= 5, `${s.id} has several writers`);
    const who = new Set(s.voices!.map((v) => v.who));
    assert.equal(who.size, s.voices!.length, `${s.id} names each writer once`);
    for (const v of s.voices!) {
      assert.ok(v.text.length > 3, `${s.id} ${v.who}`);
      if (v.sourceId) assert.ok(getSource(v.sourceId), `${s.id} cites ${v.sourceId}`);
    }
  }
  for (const s of STAVES.filter((x) => x.aicme !== 0)) assert.ok(!s.laterName && !s.voices && !s.kennings, s.id);
  for (const id of CITES["ogham.forfeda-modern"]) assert.ok(getSource(id), id);
});

test("an own name for a stave is in the export with the stave in words", () => {
  const data = shapeOwnExport([], [], [], new Map(), { "ogham-eabhadh": "the grove gate" });
  assert.deepEqual(data.own_names, [{ piece: "Ogham · Éabhadh", piece_id: "ogham-eabhadh", name: "the grove gate" }]);
  assert.ok(ownMarkdown(data).join("\n").includes("- Ogham · Éabhadh: the grove gate"));
});

test("migration 102 only adds the switch, off to start, and older versions can use the data", () => {
  const sql = readFileSync(new URL("../migrations/102_ogham_later_names.sql", import.meta.url), "utf8");
  assert.match(sql, /-- older-versions: ok/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS ogham_later_names INTEGER NOT NULL DEFAULT 0/);
  assert.ok(!/CREATE TABLE/.test(sql), "own names use symbol_own_names (migration 076)");
});
