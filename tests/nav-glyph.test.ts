// Every navigation link that is not a tool has a drawn picture (open item T16), and the drawings follow the design rules. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NAV_FOLD_KEYS, NAV_GROUPS } from "../lib/nav-groups";

const source = readFileSync(new URL("../components/ui/NavGlyph.tsx", import.meta.url), "utf8");
const groupsAt = source.indexOf("const GROUP_DRAWINGS");
const keysIn = (text: string) => [...text.matchAll(/^  (\w+): (?:\(|<)/gm)].map((m) => m[1]);
const drawn = keysIn(source.slice(0, groupsAt));
const groupDrawn = keysIn(source.slice(groupsAt, source.indexOf("export const hasNavGlyph")));

test("every link that is not a tool has a drawing, and the Admin section has its own mark", () => {
  const ids = NAV_GROUPS.flatMap((g) => g.items).filter((i) => !i.id.startsWith("tool-")).map((i) => i.id);
  assert.deepEqual([...drawn].sort(), [...ids, "admin"].sort());
});

test("the Admin mark is a pentacle", () => {
  const admin = source.split("  admin: (")[1]?.split("\n  ),")[0] ?? "";
  assert.match(admin, /<circle cx="12" cy="12" r="9\.5" \/>/);
  assert.match(admin, /<path d="M12 3 L17\.3 20 L3\.2 9\.1 H20\.8 L6\.7 20 Z" \/>/);
});

test("every heading that folds has a drawing, so the folded groups differ in the narrow menu, and Your tools has its own", () => {
  // Admin's heading shows its key on the left and the pentacle from the link drawings after the word (owner's request, 2026-10-26).
  assert.deepEqual([...groupDrawn].sort(), [...NAV_FOLD_KEYS, "tools"].sort());
  assert.ok(drawn.includes("admin"));
  const nav = readFileSync(new URL("../components/nav/NavBody.tsx", import.meta.url), "utf8");
  assert.match(nav, /<NavGlyph id=\{foldKey\} group[^>]*\/>\s*<span className="nav-text">\{group.label\}<\/span>\s*\{group.id === "admin" && <NavGlyph id="admin"/, "the key before the word, the pentacle after it");
});

test("the drawings use the text colour, carry no words and no inline style, and hide from a screen reader", () => {
  assert.ok(source.includes('stroke="currentColor"') && source.includes('aria-hidden="true"'));
  assert.ok(!/style=\{|style="|#[0-9a-fA-F]{3,6}\b/.test(source), "no style attribute and no colour of its own");
  assert.ok(!/<text\b/.test(source), "no lettering inside a drawing");
  assert.deepEqual([...source.matchAll(/^import .* from "([^"]+)"/gm)].map((m) => m[1]), [], "it imports nothing");
});

test("the emoji stay in the navigation data as the fallback", () => {
  for (const item of NAV_GROUPS.flatMap((g) => g.items)) assert.ok(item.icon, `${item.label} keeps its emoji`);
});
