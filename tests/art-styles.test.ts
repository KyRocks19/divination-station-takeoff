// Checks on the picture-maker's saved style notes (open item P1; migration 078). Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { MAX_STYLE_LENGTH } from "../lib/art-maker";
import { MAX_ART_STYLE_NAME, MAX_ART_STYLES, addToNote, cleanStyleName, cleanStyleText } from "../lib/art-styles-core";

const root = path.join(__dirname, "..");
const read = (f: string) => readFileSync(path.join(root, f), "utf8");

test("a style note is tidied; empty clears it; too long is refused, not cut", () => {
  assert.equal(cleanStyleText("  ink   drawing,  grey "), "ink drawing, grey");
  assert.equal(cleanStyleText(""), null);
  assert.equal(cleanStyleText("   "), null);
  assert.equal(cleanStyleText(null), null);
  assert.equal(cleanStyleText(undefined), null);
  assert.equal(cleanStyleText("x".repeat(MAX_STYLE_LENGTH)), "x".repeat(MAX_STYLE_LENGTH));
  assert.equal(cleanStyleText("x".repeat(MAX_STYLE_LENGTH + 1)), undefined);
  assert.equal(cleanStyleText(12), undefined);
});

test("a style's name is 1 to 40 characters of text", () => {
  assert.equal(cleanStyleName("  Soft   ink "), "Soft ink");
  assert.equal(cleanStyleName(""), null);
  assert.equal(cleanStyleName("x".repeat(MAX_ART_STYLE_NAME + 1)), null);
  assert.equal(cleanStyleName(3), null);
});

test("adding a saved style to the note does not repeat it and respects the limit", () => {
  assert.equal(addToNote("", "ink wash"), "ink wash");
  assert.equal(addToNote("grey tones", "ink wash"), "grey tones, ink wash");
  assert.equal(addToNote("Ink Wash, grey", "ink wash"), "Ink Wash, grey");
  assert.ok(addToNote("a".repeat(MAX_STYLE_LENGTH - 10), "bbbbbbbbbbbbbbbbbbbb").length <= MAX_STYLE_LENGTH);
});

test("migration 078 makes the tables, and 089 sets the note limit to the current MAX_STYLE_LENGTH", () => {
  const first = read("migrations/078_art_styles.sql");
  const widened = read("migrations/089_art_style_length.sql");
  assert.ok(widened.includes(`char_length(art_style) <= ${MAX_STYLE_LENGTH}`));
  assert.ok(widened.includes(`char_length(text) BETWEEN 1 AND ${MAX_STYLE_LENGTH}`));
  assert.ok(!/\bTRUNCATE\b|\bDROP\s+(TABLE|COLUMN)\b/i.test(widened.replace(/--.*$/gm, "")));
  const sql = first;
  assert.ok(sql.includes(`char_length(name) BETWEEN 1 AND ${MAX_ART_STYLE_NAME}`));
  assert.match(sql, /user_id\s+INTEGER NOT NULL REFERENCES users\(id\) ON DELETE CASCADE/);
  assert.ok(!/\bDROP\b|\bTRUNCATE\b/i.test(sql.replace(/--.*$/gm, "")));
  assert.ok(MAX_ART_STYLES >= 10);
});

test("every route checks who is asking, and every query is for one person", () => {
  for (const f of ["app/api/oracle/styles/route.ts", "app/api/oracle/styles/[id]/route.ts", "app/api/oracle/decks/[id]/style/route.ts"]) {
    const src = read(f);
    const handlers = src.match(/export async function (GET|POST|PUT|DELETE)/g)?.length ?? 0;
    assert.ok(handlers >= 1);
    assert.equal(src.match(/requireUser\(\)/g)?.length, handlers, f);
  }
  const lib = read("lib/art-styles.ts");
  for (const sql of lib.match(/"(SELECT|INSERT|UPDATE|DELETE)[^"]*"/g) ?? []) assert.ok(/user_id/.test(sql), sql);
  assert.ok(/WHERE id = \$1 AND user_id = \$2/.test(lib), "a set is changed only when it is the person's own");
});

test("the export has the set's note and the named styles, and the picture-maker still sends only what the person sees", () => {
  const exp = read("lib/export-tools.ts");
  assert.ok(exp.includes("picture_style_note") && exp.includes("picture_styles"));
  const maker = read("components/oracle/ArtMaker.tsx");
  assert.ok(maker.includes("joinPrompt(scene, style, composition)"), "the style box is what goes into the prompt");
  assert.ok(/The words it will be sent|prompt/i.test(maker));
});
