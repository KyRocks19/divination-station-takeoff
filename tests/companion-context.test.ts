import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MAX_CONTEXT_CHARS, formatContext, type ContextInput } from "../lib/companion-context";

const base: ContextInput = {
  noun: "stone",
  when: "2026-10-14",
  question: "What should I carry this week?",
  layoutName: "Three pebbles",
  items: [
    {
      name: "Tide",
      reversed: true,
      position: "What I carry",
      positionPrompt: "What weighs on me?",
      origin: "A beach in Wales",
      fields: [{ name: "song", value: "The sea at night" }],
      meanings: [{ label: "Gran", content: "Being looked after", upsideDown: false }],
      earlierMeanings: [{ when: "2026-02-10", label: "Gran", content: "Quiet and safe", upsideDown: false }],
      earlier: [
        { when: "2026-03-02", question: null, reversed: false, entries: [{ when: "2026-03-02", kind: "note", thinkingMind: false, content: "Felt like a hug." }] },
        { when: "2026-08-20", question: "Am I rested?", reversed: false, entries: [] },
      ],
    },
  ],
  entries: [
    { when: "2026-10-14", kind: "impression", thinkingMind: false, content: "red water" },
    { when: "2026-10-14", kind: "note", thinkingMind: true, content: "probably my sister again" },
  ],
};

test("every line is the person's own words, labelled and dated", () => {
  const { text, truncated } = formatContext(base);
  assert.equal(truncated, false);
  assert.match(text, /Your stone reading of 2026-10-14\./);
  assert.match(text, /Your question: What should I carry this week\?/);
  assert.match(text, /The stone that came up: Tide \(upside down\)/);
  assert.match(text, /You wrote that it comes from: A beach in Wales/);
  assert.match(text, /You wrote under "song": The sea at night/);
  assert.match(text, /You wrote \(Gran\) as its meaning: Being looked after/);
  assert.match(text, /You wrote, as what you noticed first on 2026-10-14: red water/);
  assert.match(text, /you marked this as your thinking mind rather than what you sensed/);
});

test("earlier readings come newest first", () => {
  const { text } = formatContext(base);
  assert.ok(text.indexOf("2026-08-20") < text.indexOf("2026-03-02"));
});

test("it stays within the limit and says when something was left out", () => {
  const long = { ...base, entries: Array.from({ length: 40 }, (_, i) => ({ when: `2026-10-${String((i % 28) + 1).padStart(2, "0")}`, kind: "note" as const, thinkingMind: false, content: `entry ${i} ` + "x".repeat(400) })) };
  const { text, truncated } = formatContext(long);
  assert.ok(text.length <= MAX_CONTEXT_CHARS);
  assert.equal(truncated, true);
  assert.match(text, /entry 39 /); // the newest writing is kept
  assert.doesNotMatch(text, /entry 0 /); // the oldest goes first
});

test("an empty reading still gives a short, honest text", () => {
  const { text } = formatContext({ noun: "card", when: "2026-10-14", question: null, layoutName: null, items: [], entries: [] });
  assert.equal(text, "Your card reading of 2026-10-14.");
});

test("the context builder imports no stock text: no tarot deck, meaning files, common meanings, or archetype texts", () => {
  const source = readFileSync(new URL("../lib/companion-context.ts", import.meta.url), "utf8");
  const imports = [...source.matchAll(/^import .* from "(.+)";$/gm)].map((m) => m[1]);
  // ./companion-own reads only the person's own archetypes and concepts (never the app's: see the test at the end of this file).
  // ./companion-guess reads only a guess the person ticked for the companion on that reading (owner decision 2026-10-22).
  assert.deepEqual(imports.sort(), ["./companion-guess", "./companion-own", "./divinations", "./oracle", "./oracle-forms"]);
});

test("earlier wordings of a meaning are only sent when asking what has changed, and are dated", () => {
  const plain = formatContext(base);
  assert.doesNotMatch(plain.text, /Quiet and safe/);
  assert.equal(plain.hasHistory, true);
  const withHistory = formatContext(base, MAX_CONTEXT_CHARS, { history: true });
  assert.match(withHistory.text, /On 2026-02-10 you wrote \(Gran\) as the meaning of Tide: Quiet and safe/);
  // Newest first: August, then March, then February.
  assert.ok(withHistory.text.indexOf("2026-08-20") < withHistory.text.indexOf("2026-03-02"));
  assert.ok(withHistory.text.indexOf("2026-03-02") < withHistory.text.indexOf("2026-02-10"));
});

test("hasHistory is false when there is nothing earlier to set beside today's words", () => {
  const none = formatContext({ ...base, items: [{ ...base.items[0], earlier: [], earlierMeanings: [] }] });
  assert.equal(none.hasHistory, false);
});

test("extra lines go under the heading", () => {
  const { text } = formatContext({ noun: "scrying", when: "2026-10-14", question: null, layoutName: null, extra: ["You looked into: a dark mirror, for 10 minutes."], items: [], entries: [] });
  assert.equal(text, "Your scrying reading of 2026-10-14.\nYou looked into: a dark mirror, for 10 minutes.");
});

test("wordings equal to the current one, or repeated, are not 'earlier'", async () => {
  const { replacedWordings } = await import("../lib/companion-context");
  const versions = [{ content: "now" }, { content: "older" }, { content: "older" }, { content: " " }, { content: "oldest" }];
  assert.deepEqual(replacedWordings("now", versions).map((v) => v.content), ["older", "oldest"]);
});

test("the other builders import no stock text either: only the database and the shared formatter", () => {
  const read = (f: string) => readFileSync(new URL(`../lib/${f}`, import.meta.url), "utf8");
  const importsOf = (f: string) => [...read(f).matchAll(/\bfrom\s+"([^"]+)"/g)].map((m) => m[1]).sort();
  // charms-core is code only (where a charm landed, in words), never stock text.
  assert.deepEqual(importsOf("companion-context-tools.ts"), ["./charms-core", "./companion-context", "./companion-guess", "./companion-own", "./db"]);
  assert.deepEqual(importsOf("companion-guess.ts"), ["./db"]);
  // Only a ticked, written guess: the query must require companion_ok and exclude set-aside ones.
  assert.match(read("companion-guess.ts"), /NOT skipped AND companion_ok/);
  assert.deepEqual(importsOf("companion-subject.ts"), ["./companion-context", "./companion-context-tools", "./companion-modes", "./companion-noticed", "./companion-pattern"]);
  // The counts builder reads only counts: the database, the shared kind names, and the type of the shared context.
  assert.deepEqual(importsOf("companion-noticed.ts"), ["./companion-context", "./companion-facts", "./db", "./divination-kinds"]);
});

// --- "What has changed" is built in code ---

import { formatTimeline } from "../lib/companion-context";

test("the timeline is the person's exact words, in the order they wrote them, with nothing added", () => {
  const input: ContextInput = {
    noun: "rune",
    when: "2026-10-14",
    question: "What do I need to keep?",
    layoutName: null,
    items: [
      {
        name: "Fehu",
        reversed: false,
        position: null,
        positionPrompt: null,
        origin: null,
        fields: [],
        meanings: [{ label: null, content: "what I have is enough", upsideDown: false, when: "2026-09-01" }],
        earlierMeanings: [{ when: "2026-02-01", label: null, content: "money I should earn", upsideDown: false }],
        earlier: [{ when: "2026-03-02", question: "What do I have?", reversed: false, entries: [{ when: "2026-03-02", kind: "note", thinkingMind: false, content: "Felt like pressure." }] }],
      },
    ],
    entries: [{ when: "2026-10-14", kind: "impression", thinkingMind: false, content: "The cow again. My chest loosened." }],
  };
  const t = formatTimeline(input);
  const lines = t.split("\n");
  const dated = lines.filter((l) => /^\d{4}-\d{2}-\d{2}  /.test(l));
  // Earliest to latest, and every line starts with the day it belongs to.
  assert.deepEqual(dated.map((l) => l.slice(0, 10)), ["2026-02-01", "2026-03-02", "2026-03-02", "2026-09-01", "2026-10-14", "2026-10-14"]);
  assert.match(t, /2026-02-01  You wrote as its meaning: money I should earn/);
  assert.match(t, /2026-03-02  Fehu came up\. You asked: What do I have\?/);
  assert.match(t, /2026-03-02  You wrote: Felt like pressure\./);
  assert.match(t, /2026-09-01  You wrote as its meaning: what I have is enough/);
  assert.match(t, /2026-10-14  You wrote, as what you noticed first: The cow again\. My chest loosened\./);
  assert.match(t, /Nothing above says what changed or why/);
  // It never explains, judges, or names a change.
  assert.doesNotMatch(t, /growth|progress|improv|mistake|shift|moved on|you have changed/i);
  // It is the same every time.
  assert.equal(formatTimeline(input), t);
});

test("formatContext builds the timeline only when asked for history, and only when there is some", () => {
  assert.equal(formatContext(base).timeline, undefined);
  assert.match(formatContext(base, MAX_CONTEXT_CHARS, { history: true }).timeline ?? "", /Your own words, in the order you wrote them/);
  const none = formatContext({ ...base, items: [{ ...base.items[0], earlier: [], earlierMeanings: [] }] }, MAX_CONTEXT_CHARS, { history: true });
  assert.equal(none.timeline, undefined);
});

test("a very long history leaves out the oldest lines first and says so", () => {
  const many = Array.from({ length: 80 }, (_, i) => ({ when: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`, kind: "note" as const, thinkingMind: false, content: `entry ${i} ` + "x".repeat(150) }));
  const t = formatTimeline({ ...base, items: [{ ...base.items[0], earlier: [{ when: "2025-12-01", question: null, reversed: false, entries: many }], earlierMeanings: [] }] });
  assert.ok(t.length < 6000);
  assert.match(t, /oldest lines were left out/);
});

test("a guess the person ticked for the companion is sent, labelled as sensed first; none is sent otherwise", () => {
  const without = formatContext(base).text;
  assert.doesNotMatch(without, /sensed first/);
  const withGuess = formatContext({ ...base, sensedFirst: { when: "2026-10-14", text: "a door left open" } }).text;
  assert.match(withGuess, /What you sensed first, written and sealed on 2026-10-14 before you opened any meaning: a door left open/);
});
