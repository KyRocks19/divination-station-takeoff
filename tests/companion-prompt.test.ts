import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SAFETY_LINES, askQuestionsMessage, companionSystemPrompt } from "../lib/companion-prompt";
import { chatRequest, makeConfig, stripThinking, type Scenario } from "../scripts/companion-bakeoff";

test("the system prompt always carries the safety lines and the person's name for the companion", () => {
  const p = companionSystemPrompt("Ember");
  assert.match(p, /^You are Ember, /);
  for (const line of SAFETY_LINES) assert.ok(p.includes(line));
  assert.match(p, /not a person/);
  assert.match(p, /never supply a meaning/);
});

test("the ask message is the person's words plus the ask", () => {
  assert.equal(askQuestionsMessage("Your card reading of 2026-10-14."), "Your card reading of 2026-10-14.\n\nAsk me questions about this reading.");
});

test("the bake-off request names the model only when given one, and uses the real prompt", () => {
  const s: Scenario = { id: "x", title: "x", look_for: "x", context: "Your card reading of 2026-10-14." };
  assert.equal("model" in chatRequest(null, "Companion", s, 400, 0.7), false);
  const r = chatRequest("a.kcpps", "Companion", s, 400, 0.7);
  assert.equal(r.model, "a.kcpps");
  assert.equal(r.messages[0].content, companionSystemPrompt("Companion"));
  assert.ok(r.messages[1].content.startsWith("Your card reading"));
});

test("thinking is removed from replies, including a reply cut off after the closing tag", () => {
  assert.equal(stripThinking("<think>hmm\nmore</think>\n1. A question?"), "1. A question?");
  assert.equal(stripThinking("some reasoning</think>1. A question?"), "1. A question?");
  assert.equal(stripThinking("1. Plain."), "1. Plain.");
});

test("a made config swaps in the text model, drops the image model, and keeps the other settings", () => {
  const cfg = makeConfig({ sdmodel: "C:/img.safetensors", port: 5001, threads: 8, model: [] }, ["C:", "Models", "q.gguf"].join(String.fromCharCode(92)), 4096);
  assert.deepEqual(cfg.model, ["C:/Models/q.gguf"]);
  assert.equal(cfg.model_param, "C:/Models/q.gguf");
  assert.equal(cfg.sdmodel, "");
  assert.equal(cfg.contextsize, 4096);
  assert.equal(cfg.threads, 8);
});

test("every bake-off situation has what it needs, and none uses stock tarot or archetype text", () => {
  const list: Scenario[] = JSON.parse(readFileSync(new URL("../scripts/companion-bakeoff-scenarios.json", import.meta.url), "utf8"));
  assert.ok(list.length >= 20);
  assert.equal(new Set(list.map((s) => s.id)).size, list.length);
  for (const s of list) {
    assert.ok(s.id && s.title && s.look_for && s.context, s.id);
    assert.doesNotMatch(s.context, /Rider|Waite|Pixie|Major Arcana|Cups|Pentacles/i, s.id);
  }
});

test("the questions always end with what would show the reading wrong (release plan idea 6)", () => {
  const source = readFileSync(new URL("../lib/companion-prompt.ts", import.meta.url), "utf8");
  assert.match(source, /last question always one that asks, in your own words, what could happen that would show them this reading was wrong/);
});
