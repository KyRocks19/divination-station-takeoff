// Checks on the example cloths: each is a valid cloth, says where it comes from and how settled it is, and is never added without a choice. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { cleanCloth, landing } from "../lib/cloth-core";
import { EXAMPLE_CLOTHS, exampleToCloth } from "../lib/cloth-examples";
import { getSource } from "../lib/sources";

const root = path.join(__dirname, "..");

test("every example passes the same checks as a cloth the person types", () => {
  for (const ex of EXAMPLE_CLOTHS) {
    const c = cleanCloth(exampleToCloth(ex));
    assert.ok(c.ok, `${ex.id}: ${c.ok ? "" : c.error}`);
  }
});

test("every example names its source and says how settled it is", () => {
  const ids = new Set<string>();
  for (const ex of EXAMPLE_CLOTHS) {
    assert.ok(!ids.has(ex.id), `${ex.id} twice`);
    ids.add(ex.id);
    assert.match(ex.source.url, /^https:\/\//, ex.id);
    assert.ok(ex.source.cite.length > 10 && ex.source.checked.length > 10, ex.id);
    assert.ok(ex.settled.length > 40, ex.id);
    assert.ok(exampleToCloth(ex).description.includes(ex.source.cite), `${ex.id}: the copy keeps its source`);
  }
});

test("the Tacitus example matches the source card the app already has", () => {
  const card = getSource("tacitus-germania");
  const ex = EXAMPLE_CLOTHS.find((e) => e.id === "white-cloth")!;
  assert.equal(ex.source.cite, card?.cite);
  assert.equal(ex.source.url, card?.url);
  assert.equal(ex.zones.length, 0);
});

test("an example from one author's page is not described as a tradition", () => {
  for (const ex of EXAMPLE_CLOTHS.filter((e) => e.source.url.includes("mysticryst"))) {
    assert.match(ex.settled, /not known to be a tradition/);
    assert.doesNotMatch(exampleToCloth(ex).description, /ancient|traditional|since/i);
  }
});

test("the four directions cover the whole cloth, each point in exactly the quarter it is in", () => {
  const ex = EXAMPLE_CLOTHS.find((e) => e.id === "four-directions")!;
  const where = (x: number, y: number) => {
    const l = landing(ex.zones, x, y);
    return l.kind === "zone" ? l.zone.name : l.kind;
  };
  assert.equal(where(500, 100), "North: earth");
  assert.equal(where(900, 500), "East: air");
  assert.equal(where(500, 900), "South: fire");
  assert.equal(where(100, 500), "West: water");
  for (const [x, y] of [[0, 0], [1000, 0], [0, 1000], [1000, 1000], [500, 500]]) assert.notEqual(where(x, y), "none", `${x},${y}`);
});

test("the four corners cover the whole cloth", () => {
  const ex = EXAMPLE_CLOTHS.find((e) => e.id === "four-corners")!;
  for (const [x, y] of [[0, 0], [1000, 0], [0, 1000], [1000, 1000], [250, 250], [750, 750]]) assert.equal(landing(ex.zones, x, y).kind, "zone", `${x},${y}`);
});

test("the example list is only reached through the explicit button, never from a page", () => {
  const users: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name === ".next" || e.name === ".git" || e.name === "tests") continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(e.name) && readFileSync(p, "utf8").includes("cloth-examples")) users.push(path.relative(root, p).replace(/\\/g, "/"));
    }
  };
  for (const d of ["app", "components", "lib"]) walk(path.join(root, d));
  assert.deepEqual(users.sort(), ["components/cloth/ExampleCloths.tsx"]);
});

test("lib/cloth-examples.ts imports only the cloth core", () => {
  const src = readFileSync(path.join(root, "lib", "cloth-examples.ts"), "utf8");
  assert.deepEqual([...src.matchAll(/^import .* from "([^"]+)"/gm)].map((m) => m[1]), ["./cloth-core"]);
});
