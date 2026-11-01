// Checks on the cloth form's numbers, the export of cloths, and the way cloth data is kept private. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ZONE_SHAPES, defaultGeom, type Geom } from "../lib/cloth-core";
import { SHAPE_FIELDS, defaultForm, formToGeom, geomToForm, typedNumber } from "../lib/cloth-form";
import { ownMarkdown, shapeClothExport, shapeOwnExport } from "../lib/export-own-core";

const root = path.join(__dirname, "..");
const read = (f: string) => readFileSync(path.join(root, f), "utf8");

test("typed numbers: digits with one decimal, a comma counts as a point, anything else is refused", () => {
  assert.equal(typedNumber("12"), 12);
  assert.equal(typedNumber(" 12.5 "), 12.5);
  assert.equal(typedNumber("12,5"), 12.5);
  assert.equal(typedNumber("-3"), -3);
  for (const bad of ["", "abc", "1e3", "1.234", "12 5", "--1", undefined]) assert.equal(typedNumber(bad as string | undefined), null, String(bad));
});

test("every shape goes to the form's boxes and back to the same geometry", () => {
  for (const s of ZONE_SHAPES) {
    const g = defaultGeom(s);
    const form = geomToForm(g);
    const back = formToGeom(s, form);
    assert.ok(back.ok, s);
    assert.deepEqual((back as { geom: Geom }).geom, g, s);
    assert.deepEqual(Object.keys(form).sort(), SHAPE_FIELDS[s].map((f) => f.name).sort(), `${s}: the form asks for exactly the fields the shape has`);
    assert.deepEqual(defaultForm(s), form);
  }
});

test("percents with a decimal become whole tenths, and a box left empty or wrong is said in words", () => {
  const r = formToGeom("circle", { cx: "12.5", cy: "50", r: "33,3" });
  assert.ok(r.ok && r.geom.shape === "circle" && r.geom.cx === 125 && r.geom.cy === 500 && r.geom.r === 333);
  const empty = formToGeom("circle", { cx: "", cy: "50", r: "10" });
  assert.deepEqual(empty, { ok: false, error: "Fill in every box with a number." });
  const outside = formToGeom("circle", { cx: "150", cy: "50", r: "10" });
  assert.ok(!outside.ok && /centre must be on the cloth/.test(outside.error));
  const ring = formToGeom("ring", { cx: "50", cy: "50", r: "20", ri: "30" });
  assert.ok(!ring.ok && /inner radius/.test(ring.error));
  const wedge = formToGeom("wedge", { cx: "50", cy: "50", r: "30", start: "350", sweep: "40" });
  assert.ok(wedge.ok && wedge.geom.shape === "wedge" && wedge.geom.start === 350 && wedge.geom.sweep === 40, "degrees are not percents");
});

test("freehand corners are typed one to a line, and a bad line is named", () => {
  const ok = formToGeom("freehand", { points: "10,10\n90,10\n50 ; 90\n" });
  assert.ok(ok.ok && ok.geom.shape === "freehand" && ok.geom.points.length === 3 && ok.geom.points[2][0] === 500);
  const bad = formToGeom("freehand", { points: "10,10\n90,ten\n50,90" });
  assert.ok(!bad.ok && /90,ten/.test(bad.error));
  assert.ok(!formToGeom("freehand", { points: "10,10\n20,20" }).ok, "two corners are not a zone");
  assert.ok(!formToGeom("freehand", { points: "10,10,10\n20,20\n30,30" }).ok, "three numbers on a line");
});

test("the export holds the cloths, the zones as drawn and where items landed, in words", () => {
  const input = {
    cloths: [{ name: "Round cloth", description: "mine", zones: [{ name: "Inner", note: "close", color: "#aabbcc", geom: defaultGeom("circle") }] }],
    placements: [
      { divination_id: 7, kind: "runes", made_at: "2026-10-18T10:00:00Z", cloth_name: "Round cloth", item_label: "Fehu (reversed)", where_kind: "zone" as const, zone_name: "Inner", facing: "down", simulated: false },
      { divination_id: 7, kind: "runes", made_at: "2026-10-18T10:00:00Z", cloth_name: "Round cloth", item_label: "Uruz", where_kind: "off" as const, zone_name: null, facing: null, simulated: true },
    ],
  };
  const shaped = shapeClothExport(input);
  assert.equal(shaped.cloths[0].zones[0].shape, "circle");
  assert.deepEqual(shaped.cloth_placements.map((p) => [p.item, p.where, p.facing, p.thrown_by_the_app]), [
    ["Fehu (reversed)", "in Inner", "face down", false],
    ["Uruz", "off the cloth", null, true],
  ]);
  const text = ownMarkdown(shapeOwnExport([], [], [], new Map(), {}, input)).join("\n");
  assert.ok(text.includes("## Your cloths") && text.includes("- Inner (circle): close"));
  assert.ok(text.includes("Fehu (reversed) in Inner, face down") && text.includes("Uruz off the cloth (thrown by the app)"));
  assert.deepEqual(ownMarkdown(shapeOwnExport([], [], [], new Map())), [], "nothing is written when there are no cloths");
});

test("migration 077: every table of cloth data cascades with the account, and a deleted cloth keeps the record of where items landed", () => {
  const sql = read("migrations/077_cloths.sql");
  const tables = [...sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+) \(([\s\S]*?)\n\);/g)];
  assert.deepEqual(tables.map((t) => t[1]), ["cloths", "cloth_zones", "cloth_placements"]);
  for (const [, name, body] of tables) assert.match(body, /user_id\s+INTEGER NOT NULL REFERENCES users\(id\) ON DELETE CASCADE/, `${name} cascades with the account`);
  assert.match(tables[1][2], /cloth_id\s+INTEGER NOT NULL REFERENCES cloths\(id\) ON DELETE CASCADE/);
  assert.match(tables[2][2], /cloth_id\s+INTEGER REFERENCES cloths\(id\) ON DELETE SET NULL/, "the record stays, with the cloth's name as it was");
  assert.match(tables[2][2], /divination_id\s+INTEGER NOT NULL REFERENCES divinations\(id\) ON DELETE CASCADE/);
  assert.match(sql, /UNIQUE \(divination_id, item_index\)/);
  assert.ok(!/\bDROP\b|\bTRUNCATE\b/i.test(sql.replace(/--.*$/gm, "")), "additive only");
});

test("every cloth query is for one person, and the routes check who is asking", () => {
  const lib = read("lib/cloths.ts");
  const sqls = [...lib.matchAll(/(?:query|queryOne|client\.query)(?:<[^`]*?>)?\(\s*`?"?((?:SELECT|UPDATE|DELETE|INSERT)[^`"]*)/g)].map((m) => m[1]);
  assert.ok(sqls.length >= 12, `found ${sqls.length} statements`);
  for (const s of sqls) {
    if (/^INSERT INTO cloth/.test(s)) assert.ok(/user_id/.test(s) || /\(\s*user_id/.test(s) || /INSERT INTO cloths \(user_id|INSERT INTO cloth_zones \(user_id|INSERT INTO cloth_placements/.test(s), s.slice(0, 60));
    else assert.ok(/user_id|\$1/.test(s), `scoped: ${s.slice(0, 70)}`);
  }
  for (const f of ["app/api/cloths/route.ts", "app/api/cloths/[id]/route.ts", "app/api/divinations/[id]/cloth/route.ts"]) {
    const src = read(f);
    const handlers = src.match(/export async function (GET|POST|PUT|DELETE)/g)?.length ?? 0;
    assert.equal(src.match(/requireUser\(\)/g)?.length, handlers, `${f}: every handler checks who is asking`);
  }
  assert.ok(read("app/api/divinations/[id]/cloth/route.ts").includes("clothKindOf(userId, id)"), "the reading must be the person's own");
});

test("cloth words stay out of the companion and the shared forum", () => {
  for (const f of ["lib/companion-context.ts", "lib/companion-own.ts", "lib/forum-snapshots.ts", "lib/patterns.ts"]) {
    try {
      assert.ok(!/cloth/i.test(read(f)), `${f} does not read cloth data`);
    } catch (err) {
      if ((err as { code?: string }).code !== "ENOENT") throw err;
    }
  }
});
