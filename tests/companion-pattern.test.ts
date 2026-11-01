import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PATTERN_REF_RE, parsePatternRef, patternRef } from "../lib/companion-pattern-ref";
import { formatPatternContext, type PatternInput } from "../lib/companion-pattern";
import { SAFETY_LINES, askMessage, companionSystemPrompt } from "../lib/companion-prompt";
import { runCompanion, usable, type AskModel, type ChatMessage } from "../lib/companion-run";
import { COMPANION_MODES, MODE_BUTTONS } from "../lib/companion-modes";
import { SNAPSHOT_ONLY, ITEM_KINDS } from "../lib/days-core";
import { CRISIS_REPLY } from "../lib/companion-safety";

const input = (over: Partial<PatternInput> = {}): PatternInput => ({
  name: "Fehu",
  toolLabel: "Runes",
  readings: [
    { when: "2026-03-10T08:30:00.000Z", question: "Should I move?", entries: [{ when: "2026-03-10", kind: "impression", thinkingMind: false, content: "The colour first." }] },
    { when: "2026-06-10T08:30:00.000Z", question: null, entries: [{ when: "2026-06-11", kind: "note", thinkingMind: true, content: "I think it is about work." }] },
  ],
  earlier: 0,
  wordings: [{ when: "2026-03-10T10:00:00.000Z", text: "cattle — my savings" }, { when: "2026-09-01T10:00:00.000Z", text: "flow — money moves through me" }],
  ...over,
});

test("a pattern is named by its tool and the symbol's own key, colons in the key included, and nothing else is accepted", () => {
  assert.equal(patternRef("runes", "rune-fehu"), "runes:rune-fehu");
  assert.deepEqual(parsePatternRef("runes:rune-fehu"), { kind: "runes", key: "rune-fehu" });
  assert.deepEqual(parsePatternRef("dice:d6:3"), { kind: "dice", key: "d6:3" });
  assert.deepEqual(parsePatternRef("tarot:major-16"), { kind: "tarot", key: "major-16" });
  for (const bad of ["", "rune-fehu", "spoons:x", "runes:", ":x", "runes:../etc/passwd", "runes:a b", "runes:" + "x".repeat(200), "RUNES:x", "runes:x;DROP", undefined, 5, null, ["runes:x"]]) {
    assert.equal(parsePatternRef(bad), null, String(bad));
  }
  assert.ok(PATTERN_REF_RE.test("oracle:name:Lantern"));
});

test("the pattern's words are dates and the person's own words, in order, labelled, with nothing added", () => {
  const { text, truncated, hasHistory } = formatPatternContext(input());
  assert.equal(truncated, false);
  assert.equal(hasHistory, true);
  assert.match(text, /^A pattern in your readings: Fehu \(Runes\)\.\nIt came up in 2 readings\./);
  assert.match(text, /On 2026-03-10 it came up\. Your question then: Should I move\?\nYou wrote, as what you noticed first on 2026-03-10: The colour first\./);
  assert.match(text, /On 2026-06-10 it came up\.\nYou wrote on 2026-06-11 \(you marked this as your thinking mind rather than what you sensed\): I think it is about work\./);
  assert.match(text, /Your own wordings of Fehu, oldest first:\nOn 2026-03-10 you wrote as its meaning: cattle — my savings\nOn 2026-09-01 you wrote as its meaning: flow — money moves through me/);
  assert.ok(text.indexOf("2026-03-10 it came up") < text.indexOf("2026-06-10 it came up"));
});

test("a pattern with nothing recurring is still a pattern (wordings only), and says how many earlier readings are not listed", () => {
  const w = formatPatternContext(input({ readings: [], wordings: [{ when: "2026-03-10", text: "a" }, { when: "2026-04-10", text: "b" }] }));
  assert.ok(!w.text.includes("It came up in"));
  assert.equal(w.hasHistory, true);
  const more = formatPatternContext(input({ earlier: 5 }));
  assert.match(more.text, /It came up in 7 readings; the 2 most recent are set out below\./);
});

test("when it is too long the oldest readings go first, the wordings stay, and it says so", () => {
  const many = Array.from({ length: 12 }, (_, i) => ({
    when: `2026-0${(i % 9) + 1}-10T00:00:00.000Z`,
    question: `question number ${i}`,
    entries: [{ when: "2026-01-01", kind: "note" as const, thinkingMind: false, content: `entry number ${i} ` + "x".repeat(300) }],
  }));
  const out = formatPatternContext(input({ readings: many }), 2000);
  assert.ok(out.text.length <= 2000);
  assert.equal(out.truncated, true);
  assert.ok(!out.text.includes("entry number 0 "), "the oldest was dropped");
  assert.ok(out.text.includes("entry number 11 "), "the newest stayed");
  assert.match(out.text, /Your own wordings of Fehu/);
});

test("the pattern builder and its helpers read only the person's rows: no stock text, theme names, or data files", () => {
  const read = (f: string) => readFileSync(new URL(`../lib/${f}`, import.meta.url), "utf8");
  const importsOf = (f: string) => [...read(f).matchAll(/\bfrom\s+"([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(importsOf("companion-pattern.ts"), ["./companion-context", "./companion-context-tools", "./companion-pattern-ref", "./companion-pattern-ref", "./db", "./divination-kinds", "./patterns-symbols"].sort());
  assert.deepEqual(importsOf("companion-pattern-ref.ts"), ["./divination-kinds"]);
  assert.deepEqual(importsOf("patterns-symbols.ts"), ["./date", "./db", "./divination-kinds", "./patterns-core"]);
  assert.ok(!/archetype|common-meanings|runes-data|ogham-data|lib\/cards/.test(read("patterns-symbols.ts") + read("companion-pattern.ts")), "no data file is mentioned");
});

test("the Patterns page (a client component) imports the pattern's name format but not the builder", () => {
  for (const f of ["components/AcrossTools.tsx", "components/PatternQuestion.tsx"]) {
    const imports = readFileSync(f, "utf8").split("\n").filter((l) => l.startsWith("import ") && !l.startsWith("import type"));
    assert.ok(!imports.some((l) => /companion-pattern"|lib\/(db|patterns|days)"|\/db"/.test(l)), `${f} imports no server code`);
  }
});

test("the pattern request has its own job in the prompt, the person's focus before the safety lines, and the safety lines last", () => {
  assert.ok(COMPANION_MODES.includes("pattern"));
  assert.ok(MODE_BUTTONS.pattern);
  const p = companionSystemPrompt("Ember", false, "pattern", "FOCUS BLOCK");
  assert.match(p, /a pattern in their own readings/);
  assert.match(p, /Never say what the symbol means, never say whether a change is growth or noise/);
  assert.ok(p.indexOf("FOCUS BLOCK") > 0 && p.indexOf("FOCUS BLOCK") < p.indexOf("Always:"));
  assert.ok(p.trimEnd().endsWith(SAFETY_LINES[SAFETY_LINES.length - 1]));
  assert.notEqual(p, companionSystemPrompt("Ember", false, "questions", "FOCUS BLOCK"));
  assert.match(askMessage("X", "pattern"), /questions about this pattern/);
  // The same care about variety applies as for questions about a reading.
  assert.match(p, /Do not open by repeating their whole entry/);
});

test("questions about a pattern need at least two questions, like the others", () => {
  assert.equal(usable("pattern", "1. What do you notice about the first time?\n2. What is different now?", "ctx"), true);
  assert.equal(usable("pattern", "1. Only one question?", "ctx"), false);
  assert.equal(usable("pattern", "It means you should move.", "ctx"), false);
});

test("a question about a pattern goes through the code screen and the risk check first, like every other request", async () => {
  const calls: ChatMessage[][] = [];
  const ask: AskModel = async (messages) => {
    calls.push(messages);
    return /checking a private journal/i.test(messages[0].content) ? "NO" : "1. What did you notice first?\n2. What is different now?";
  };
  const ok = await runCompanion({ context: formatPatternContext(input()).text, name: "Ember", acknowledged: false, ask, mode: "pattern" });
  assert.equal(ok.action, "questions");
  assert.equal(calls.length, 2, "a risk check, then the questions");
  assert.match(calls[0][0].content, /checking a private journal entry/);

  // Something worrying in the person's own entries stops it before any model is asked.
  const worrying = formatPatternContext(input({ readings: [{ when: "2026-03-10T00:00:00.000Z", question: null, entries: [{ when: "2026-03-10", kind: "note", thinkingMind: false, content: "I want to die." }] }] }));
  const asked: ChatMessage[][] = [];
  const stopped = await runCompanion({ context: worrying.text, name: "Ember", acknowledged: false, ask: async (m) => { asked.push(m); return "NO"; }, mode: "pattern" });
  assert.equal(stopped.action, "crisis");
  assert.equal(stopped.text, CRISIS_REPLY.en);
  assert.equal(asked.length, 0, "no model call at all");
});

test("an answer to a pattern question can be kept with a day, but only as a snapshot", () => {
  assert.ok(ITEM_KINDS.includes("pattern_answer"));
  assert.deepEqual(SNAPSHOT_ONLY, ["pattern_answer"]);
  const migration = readFileSync("migrations/058_companion_patterns.sql", "utf8");
  assert.match(migration, /'pattern_answer'/);
  assert.match(migration, /'pattern'\)\)/);
  assert.match(migration, /num_nonnulls\(divination_id, card_id\) = 0/);
});
