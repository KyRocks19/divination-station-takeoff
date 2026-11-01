import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DIVINATION_KINDS } from "../lib/divination-kinds";
import { FRESH_MS, parseRevealed, revealLine, revealSpec, shouldAnimate } from "../lib/reveal-core";

test("every tool has a reveal with an animation, a wait and a line", () => {
  for (const kind of DIVINATION_KINDS) {
    const spec = revealSpec(kind);
    assert.ok(spec.ms >= 17000 && spec.ms <= 23000, kind);
    assert.ok(spec.action.length > 5, kind);
  }
  assert.equal(revealSpec("tea").scene, "brew");
  assert.equal(revealSpec("blots").scene, "ink");
  assert.equal(revealSpec("pendulum", { random: false }).random, false);
});

test("the line names the randomness method only when chance made the reading", () => {
  assert.equal(revealLine(revealSpec("oracle"), "random.org"), "Drawing your oracle cards using the random.org method for randomness…");
  assert.equal(revealLine(revealSpec("dice"), "crypto"), "Throwing your dice using the crypto method for randomness…");
  assert.equal(revealLine(revealSpec("runes"), "math"), "Drawing your runes from the bag using the Math.random() method for randomness…");
  assert.equal(revealLine(revealSpec("runes"), null), "Drawing your runes from the bag…");
  assert.equal(revealLine(revealSpec("runes"), "something else"), "Drawing your runes from the bag…");
  assert.equal(revealLine(revealSpec("scrying"), "random.org"), "Stilling the surface…");
});

test("the animation plays first for a new reading, or one whose first impression is still to come, once per tab", () => {
  const now = Date.parse("2026-10-25T12:00:00Z");
  const iso = (ms: number) => new Date(now - ms).toISOString();
  assert.equal(shouldAnimate({ held: true, createdAt: iso(10 * FRESH_MS), now, seen: false }), true);
  assert.equal(shouldAnimate({ held: true, createdAt: iso(1000), now, seen: true }), false);
  assert.equal(shouldAnimate({ held: false, createdAt: iso(1000), now, seen: false }), true);
  assert.equal(shouldAnimate({ held: false, createdAt: iso(1000), now, seen: true }), false);
  assert.equal(shouldAnimate({ held: false, createdAt: iso(FRESH_MS + 1), now, seen: false }), false);
  assert.equal(shouldAnimate({ held: false, createdAt: null, now, seen: false }), false);
  assert.equal(shouldAnimate({ held: false, createdAt: "not a date", now, seen: false }), false);
});

test("the first-impression card waits for the opening animation", () => {
  const card = readFileSync("components/GuessFirst.tsx", "utf8");
  assert.match(card, /useOpening\(divinationId\)/);
  assert.match(readFileSync("components/reveal/Reveal.tsx", "utf8"), /setOpening\(divinationId/);
});

test("the list of readings shown keeps only plain keys", () => {
  assert.deepEqual(parseRevealed("d12,t5,<x>,,d"), ["d12", "t5"]);
  assert.deepEqual(parseRevealed(null), []);
});

test("every reading view covers its result with Reveal, after the sense-first card", () => {
  const views = [
    "components/tools/ReadingShell.tsx", "components/runes/DrawView.tsx", "components/ogham/DrawView.tsx", "components/dice/ThrowView.tsx",
    "components/oracle/PullView.tsx", "components/pendulum/AnswerView.tsx", "components/scrying/SessionView.tsx", "app/readings/[id]/page.tsx",
  ];
  for (const v of views) {
    const src = readFileSync(v, "utf8");
    const reveal = src.indexOf("<Reveal ");
    assert.ok(reveal > 0, `${v} has no Reveal`);
    const guess = src.indexOf("<GuessFirst ");
    if (guess >= 0) assert.ok(guess < reveal, `${v}: the sense-first card comes before the covered reading`);
  }
  // Every tool built on the shell passes how its reading opens.
  const shellTools = readdirSync("components").flatMap((d) => {
    try { return readdirSync(`components/${d}`).map((f) => `components/${d}/${f}`); } catch { return []; }
  }).filter((f) => f.endsWith(".tsx") && readFileSync(f, "utf8").includes("<ReadingShell"));
  for (const f of shellTools) assert.match(readFileSync(f, "utf8"), /reveal=\{revealSpec\("/, f);
});
