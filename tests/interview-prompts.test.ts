import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  INTERVIEW_AUTHOR,
  cleanQa,
  interpretSystem,
  interpretUser,
  isOtherKind,
  parseQuestions,
  questionsSystem,
  questionsUser,
  savedInterview,
} from "../lib/interview-prompts";

const read = (...p: string[]) => readFileSync(path.join(process.cwd(), ...p), "utf8");

test("every kind but tarot is interviewed here; tarot keeps its own interviewer", () => {
  for (const k of ["oracle", "scrying", "pendulum", "runes", "ogham", "dice"]) assert.equal(isOtherKind(k), true, k);
  assert.equal(isOtherKind("tarot"), false);
  assert.equal(isOtherKind("tea-leaves"), false);
  assert.equal(isOtherKind(undefined), false);
});

test("the prompts name the tool, ask before they tell, and never supply a meaning", () => {
  for (const kind of ["runes", "dice", "pendulum"] as const) {
    assert.match(questionsSystem(kind), new RegExp(kind === "dice" ? "Dice and coins" : kind === "runes" ? "Runes" : "Pendulum"));
  }
  const q = questionsSystem("runes");
  assert.match(q, /JSON array/);
  assert.match(q, /Do not say what any symbol[\s\S]*traditionally means/);
  assert.match(q, /where they have written nothing[\s\S]*ask what it means to them/);
  assert.match(q, /Never say or imply that a meaning is wrong/);
  const i = interpretSystem("ogham");
  assert.match(i, /only from the notes/);
  assert.match(i, /one open question/);
  assert.doesNotMatch(q + i, /Rider|Smith|Waite|Pixie|tarot/i);
});

test("the notes and answers are put into the user message as they are", () => {
  assert.match(questionsUser("NOTES HERE"), /^NOTES HERE/);
  const u = interpretUser("NOTES", [{ question: "What stood out?", answer: "The rope." }]);
  assert.match(u, /Q1: What stood out\?\nA: The rope\./);
});

test("the saved interview holds the questions, the answers, then the reading, and is saved as the interviewer's, not the person's", () => {
  const text = savedInterview([{ question: "Q?", answer: "A." }], "The reading.");
  assert.equal(text, "**Q?**\nA.\n\n---\n\nThe reading.");
  assert.equal(INTERVIEW_AUTHOR, "interview");
});

test("questions are taken from Claude's reply with care", () => {
  assert.deepEqual(parseQuestions('Here: ["One?", " Two? "]'), ["One?", "Two?"]);
  assert.deepEqual(parseQuestions('["a","b","c","d","e","f"]')?.length, 4);
  assert.equal(parseQuestions("no list here"), null);
  assert.equal(parseQuestions("[]"), null);
  assert.equal(parseQuestions("[1, 2]"), null);
  assert.equal(parseQuestions("[not json]"), null);
});

test("the answers from a request must be a short list of question and answer texts", () => {
  assert.deepEqual(cleanQa([{ question: "q", answer: "a" }]), [{ question: "q", answer: "a" }]);
  assert.equal(cleanQa([]), null);
  assert.equal(cleanQa("x"), null);
  assert.equal(cleanQa([{ question: "q" }]), null);
  assert.equal(cleanQa(Array.from({ length: 9 }, () => ({ question: "q", answer: "a" }))), null);
  assert.equal(cleanQa([{ question: "q", answer: "a".repeat(17000) }]), null);
});

test("what the interviewer is told about a reading is only the person's own words: no stock text can reach it", () => {
  const files = [read("lib", "interview-prompts.ts"), read("lib", "companion-context.ts"), read("lib", "companion-context-tools.ts")];
  for (const src of files) {
    const imports = src.split("\n").filter((l) => /^import /.test(l)).join("\n");
    assert.doesNotMatch(imports, /["']\.\/(cards|common-meanings|archetypes|sources|card-associations|reading-context)/);
  }
  // The route builds the notes with the companion's builders and reads the saved results apart from the person's writing.
  const route = read("app", "api", "interview", "route.ts");
  assert.match(route, /buildContextFor\(userId, \{ divinationId \}/);
  assert.match(route, /INTERVIEW_AUTHOR/);
  for (const [file, re] of [["lib/divinations.ts", /j\.author = 'user'/], ["lib/companion-context-tools.ts", /j\.author = 'user'/]] as const) {
    assert.match(read(...file.split("/")), re, file);
  }
});
