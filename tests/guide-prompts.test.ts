import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DIGEST_ONE_CHARS,
  DIGEST_TOTAL_CHARS,
  OWN_WORDS_ONLY,
  PATTERN_OTHER_TOOLS,
  crossToolText,
  guideSystem,
  practiceWords,
} from "../lib/guide-prompts";

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("the guide's prompt file imports no data file: Claude is never given a stock meaning through it", () => {
  const imports = [...src("lib/guide-prompts.ts").matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(imports, ["./divination-kinds"]);
});

test("the cross-tool context only reads the person's own words, through the same builders as the companion", () => {
  const imports = [...src("lib/guide-context.ts").matchAll(/from "([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(imports, ["./companion-subject", "./db", "./divination-kinds", "./guide-prompts", "./patterns-symbols"]);
});

test("the guide names the person's practice from the tools they have used", () => {
  assert.equal(practiceWords([]), "tarot practice");
  assert.equal(practiceWords(["tarot"]), "tarot practice");
  assert.equal(practiceWords(["runes"]), "practice with runes");
  assert.equal(practiceWords(["ogham", "tarot", "runes"]), "practice with tarot, runes and ogham", "in the order the tools are listed in the app");
});

test("the guide's prompt carries the own-words rule and the person's name for the guide", () => {
  const named = guideSystem({ displayName: "Sam", guideName: "Ash", practice: "tarot practice", seekerFirst: "SEEKER FIRST" });
  assert.match(named, /They call you Ash/);
  assert.ok(named.includes(OWN_WORDS_ONLY));
  assert.ok(named.includes("SEEKER FIRST"));
  assert.match(guideSystem({ displayName: "Sam", guideName: null, practice: "x", seekerFirst: "" }), /no name yet/);
  assert.match(OWN_WORDS_ONLY, /Do not predict/);
  assert.match(PATTERN_OTHER_TOOLS, /elemental picture above belongs to the tarot suits only/);
});

test("the other-tools section is empty when there is nothing, and cut to its limits when there is a lot", () => {
  assert.equal(crossToolText({ counts: [{ kind: "tarot", n: 4 }], recurring: [], readings: [] }), "");
  const text = crossToolText({
    counts: [{ kind: "runes", n: 3 }, { kind: "tarot", n: 2 }],
    recurring: [{ kind: "runes", name: "Fehu", count: 2 }],
    readings: Array.from({ length: 20 }, () => ({ kind: "runes" as const, text: "x".repeat(DIGEST_ONE_CHARS * 2) })),
  });
  assert.match(text, /Runes 3, Tarot 2/);
  assert.match(text, /Fehu \(Runes, ×2\)/);
  assert.ok(text.length <= DIGEST_TOTAL_CHARS + 600, "kept near the total limit");
  assert.ok(text.includes("…"), "a long reading is cut short");
  assert.ok(!text.includes("x".repeat(DIGEST_ONE_CHARS + 5)));
});
