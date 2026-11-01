import { test } from "node:test";
import assert from "node:assert/strict";
import { runCompanion, screenOutcome, type AskModel, type ChatMessage } from "../lib/companion-run";
import { chatBody, companionEndpoint, companionMode, makeAsk } from "../lib/companion-model";
import { companionDailyLimit } from "../lib/companion-queue";
import { COMPANION_SETTINGS, DEFAULT_COMPANION_MODEL, companionModel } from "../lib/companion-config";
import { CHECKIN_REPLY, CRISIS_REPLY } from "../lib/companion-safety";

const ORDINARY = "Your stone reading of 2026-10-11.\n\nThe stone that came up: Sunflower\nYou wrote on 2026-10-11: Got the job!! I can't stop smiling.";
const EXPLICIT = "Your card reading of 2026-10-07.\nYou wrote on 2026-10-07: I want to die.";
const SIDEWAYS = "Your card reading of 2026-10-12.\nYou wrote on 2026-10-12: Maybe I'll just quietly stop.";
const QUESTIONS = "Warm sentence.\n\n1. What did you notice first?\n2. What is missing?";

/** A fake model that answers the risk check with `risk` and the questions with `questions`, and records what it was asked. */
function fake(risk: string, questions = QUESTIONS) {
  const calls: ChatMessage[][] = [];
  const ask: AskModel = async (messages) => {
    calls.push(messages);
    return /classify|checking a private journal/i.test(messages[0].content) ? risk : questions;
  };
  return { ask, calls };
}

test("an ordinary entry: the risk check runs first, then the questions are asked", async () => {
  const m = fake("NO");
  const out = await runCompanion({ context: ORDINARY, name: "Ember", acknowledged: false, ask: m.ask });
  assert.equal(out.action, "questions");
  assert.equal(out.text, QUESTIONS);
  assert.equal(m.calls.length, 2);
  assert.match(m.calls[0][0].content, /checking a private journal entry/);
  assert.match(m.calls[1][0].content, /^You are Ember, /);
  assert.match(m.calls[1][1].content, /Got the job/);
});

test("plain talk of ending a life gets the fixed reply and the model is never asked", async () => {
  const m = fake("NO");
  const out = await runCompanion({ context: EXPLICIT, name: "Companion", acknowledged: false, ask: m.ask });
  assert.equal(out.action, "crisis");
  assert.equal(out.text, CRISIS_REPLY.en);
  assert.equal(out.canContinue, false);
  assert.equal(m.calls.length, 0);
  // Having seen a check-in earlier makes no difference to a crisis.
  const again = await runCompanion({ context: EXPLICIT, name: "Companion", acknowledged: true, ask: m.ask });
  assert.equal(again.action, "crisis");
  assert.equal(m.calls.length, 0);
});

test("said sideways: a check-in without asking the model; after the person carries on, the risk check still runs", async () => {
  const m = fake("NO");
  const first = await runCompanion({ context: SIDEWAYS, name: "Companion", acknowledged: false, ask: m.ask });
  assert.equal(first.action, "checkin");
  assert.equal(first.text, CHECKIN_REPLY.en);
  assert.equal(first.canContinue, true);
  assert.equal(m.calls.length, 0);
  const carryOn = await runCompanion({ context: SIDEWAYS, name: "Companion", acknowledged: true, ask: m.ask });
  assert.equal(carryOn.action, "questions");
  assert.equal(m.calls.length, 2); // the risk check, then the questions
});

test("a risk check of YES stops everything, even for someone who carried on past a check-in", async () => {
  for (const acknowledged of [false, true]) {
    const m = fake("YES");
    const out = await runCompanion({ context: SIDEWAYS, name: "Companion", acknowledged, ask: m.ask });
    if (!acknowledged) assert.equal(out.action, "checkin"); // the screen pauses first
    else assert.equal(out.action, "crisis");
    assert.ok(m.calls.length <= 1);
  }
  const m = fake("YES");
  const out = await runCompanion({ context: ORDINARY, name: "Companion", acknowledged: false, ask: m.ask });
  assert.equal(out.action, "crisis");
  assert.equal(out.because, "risk-check");
  assert.equal(m.calls.length, 1); // no questions were asked
});

test("a risk check of UNSURE, or an answer that cannot be read, pauses with a check-in; acknowledging lets the questions through", async () => {
  for (const risk of ["UNSURE", "Hmm, hard to say", ""]) {
    const m = fake(risk);
    const out = await runCompanion({ context: ORDINARY, name: "Companion", acknowledged: false, ask: m.ask });
    assert.equal(out.action, "checkin", risk);
    assert.equal(m.calls.length, 1);
    const carry = await runCompanion({ context: ORDINARY, name: "Companion", acknowledged: true, ask: fake(risk).ask });
    assert.equal(carry.action, "questions", risk);
  }
});

test("the reply is tidied, and an empty reply is an error rather than a blank screen", async () => {
  const pasted = "You wrote on 2026-10-11: Got the job!! I can't stop smiling.\n\nWhat did you notice first?\nWhat is missing?";
  const out = await runCompanion({ context: ORDINARY, name: "Companion", acknowledged: false, ask: fake("NO", pasted).ask });
  assert.equal(out.text, "1. What did you notice first?\n2. What is missing?");
  await assert.rejects(runCompanion({ context: ORDINARY, name: "Companion", acknowledged: false, ask: fake("NO", "<think>nothing</think>").ask }), /no questions/);
});

test("a model that cannot be reached is an error, never a made-up safe answer", async () => {
  const down: AskModel = async () => {
    throw new Error("connect ECONNREFUSED");
  };
  await assert.rejects(runCompanion({ context: ORDINARY, name: "Companion", acknowledged: false, ask: down }), /ECONNREFUSED/);
  // The screen needs no model, so a crisis is still answered when the model is down.
  const out = await runCompanion({ context: EXPLICIT, name: "Companion", acknowledged: false, ask: down });
  assert.equal(out.action, "crisis");
});

test("screenOutcome answers alone only for what needs no model", () => {
  assert.equal(screenOutcome(ORDINARY, false), null);
  assert.equal(screenOutcome(EXPLICIT, false)?.action, "crisis");
  assert.equal(screenOutcome(SIDEWAYS, false)?.action, "checkin");
  assert.equal(screenOutcome(SIDEWAYS, true), null);
});

test("the model is reached through KoboldCpp's chat address with the chosen config, no thinking, and the password if there is one", async () => {
  assert.equal(companionEndpoint({}), null);
  assert.equal(companionMode({}), "queue");
  assert.equal(companionEndpoint({ COMPANION_URL: "ftp://x" }), null);
  const ep = companionEndpoint({ COMPANION_URL: " http://localhost:5002/ ", COMPANION_PASSWORD: "pw" })!;
  assert.deepEqual(ep, { url: "http://localhost:5002", password: "pw", model: DEFAULT_COMPANION_MODEL });
  assert.equal(companionMode({ COMPANION_URL: "http://localhost:5002" }), "direct");
  assert.equal(companionModel({ COMPANION_MODEL: "Other.kcpps" }), "Other.kcpps");

  let seen: { url: string; init: RequestInit } | null = null;
  const fetchImpl = (async (url: string, init: RequestInit) => {
    seen = { url, init };
    return new Response(JSON.stringify({ choices: [{ message: { content: "<think>x</think>NO" } }] }));
  }) as unknown as typeof fetch;
  const text = await makeAsk(ep, fetchImpl)([{ role: "user", content: "hi" }], { maxTokens: 8, temperature: 0 });
  assert.equal(text, "NO");
  assert.equal(seen!.url, "http://localhost:5002/v1/chat/completions");
  assert.equal((seen!.init.headers as Record<string, string>).Authorization, "Bearer pw");
  const body = JSON.parse(String(seen!.init.body));
  assert.equal(body.model, DEFAULT_COMPANION_MODEL);
  assert.equal(body.max_tokens, 8);
  assert.deepEqual(body.chat_template_kwargs, { enable_thinking: false });
  assert.equal(body.reasoning_effort, "none");
  assert.deepEqual(chatBody("m", [], COMPANION_SETTINGS.maxTokens, 0.7).chat_template_kwargs, { enable_thinking: false });

  const failing = (async () => new Response("no", { status: 500 })) as unknown as typeof fetch;
  await assert.rejects(makeAsk(ep, failing)([], { maxTokens: 1, temperature: 0 }), /HTTP 500/);
});

test("the daily limit is 30 unless set, and 0 switches the companion off", () => {
  assert.equal(companionDailyLimit({}), 30);
  assert.equal(companionDailyLimit({ COMPANION_DAILY_LIMIT: "12" }), 12);
  assert.equal(companionDailyLimit({ COMPANION_DAILY_LIMIT: "0" }), 0);
  assert.equal(companionDailyLimit({ COMPANION_DAILY_LIMIT: "-3" }), 30);
  assert.equal(companionDailyLimit({ COMPANION_DAILY_LIMIT: "many" }), 30);
});

// --- Keeping the questions off the worrying words ---

import { dropLines, countQuestions } from "../lib/companion-reply";
import { GENTLE_FALLBACK, lineRepeatsWorry, worryPhrases } from "../lib/companion-safety";
import { MAX_TRIES } from "../lib/companion-run";

test("worry phrases are found in the person's words, and lines that repeat them are recognised", () => {
  const phrases = worryPhrases(SIDEWAYS);
  assert.ok(phrases.includes("quietly stop"));
  assert.equal(lineRepeatsWorry('2. What does "quietly stop" feel like in your body?', phrases), true);
  assert.equal(lineRepeatsWorry("3. Where did Maybe I'll just quietly stop come from?", phrases), true);
  assert.equal(lineRepeatsWorry("1. What did you notice first about the light?", phrases), false);
  assert.deepEqual(worryPhrases(ORDINARY), []);
});

test("dropping lines renumbers the questions and says how many went", () => {
  const text = "Kind line.\n\n1. A?\n2. Bad?\n3. C?";
  const r = dropLines(text, (l) => l.includes("Bad"));
  assert.equal(r.removed, 1);
  assert.equal(r.text, "Kind line.\n\n1. A?\n2. C?");
  assert.equal(countQuestions(r.text), 2);
  assert.equal(countQuestions("No questions here."), 0);
});

test("after a check-in the questions never repeat the worrying words: bad lines are removed, and the model is asked again if too few remain", async () => {
  const replies = [
    "Glad you wrote.\n\n1. What does \"quietly stop\" feel like?\n2. Where did \"I'll just quietly stop\" come from?\n3. What about the light?", // one question left: too few
    "Glad you wrote.\n\n1. What does the quiet stop mean?\n2. What did you notice about the light?\n3. What is by the window?\n4. Where does \"quietly stop\" sit in you?", // fine after the last line goes
  ];
  let i = 0;
  const calls: ChatMessage[][] = [];
  const ask: AskModel = async (messages) => {
    calls.push(messages);
    return /checking a private journal/i.test(messages[0].content) ? "NO" : replies[Math.min(i++, replies.length - 1)];
  };
  const out = await runCompanion({ context: SIDEWAYS, name: "Companion", acknowledged: true, ask });
  assert.equal(out.action, "questions");
  assert.doesNotMatch(out.text, /quietly stop/i);
  assert.equal(countQuestions(out.text), 3);
  assert.deepEqual(out.text.split("\n").filter((l) => /^\d\./.test(l)).map((l) => l[0]), ["1", "2", "3"]);
  assert.equal(calls.length, 3); // the risk check, a first try that left too few questions, then a second that was fine
  // The gentle note was in the system prompt of the question calls.
  assert.match(calls[1][0].content, /chose to carry on/);
});

test("if the model keeps repeating the worrying words, the person gets the fixed gentle note and no questions", async () => {
  let generated = 0;
  const ask: AskModel = async (messages) => {
    if (/checking a private journal/i.test(messages[0].content)) return "NO";
    generated++;
    return "Glad you wrote.\n\n1. What does \"quietly stop\" feel like?\n2. Where did \"quietly stop\" begin?";
  };
  const out = await runCompanion({ context: SIDEWAYS, name: "Companion", acknowledged: true, ask });
  assert.equal(out.action, "gentle");
  assert.equal(out.text, GENTLE_FALLBACK.en);
  assert.equal(out.canContinue, false);
  assert.equal(generated, MAX_TRIES);
});

test("an ordinary entry is not changed by the filter", async () => {
  const out = await runCompanion({ context: ORDINARY, name: "Companion", acknowledged: false, ask: fake("NO").ask });
  assert.equal(out.text, QUESTIONS);
});

// --- The other modes: what has changed, a reading from the person's words, picture ideas ---

import { usable } from "../lib/companion-run";
import { askMessage, companionSystemPrompt } from "../lib/companion-prompt";
import { COMPANION_MODES, type ModelMode } from "../lib/companion-modes";

const MODEL_MODES: ModelMode[] = COMPANION_MODES.filter((m): m is ModelMode => m !== "changes");

const HISTORY_CTX = "Your stone reading of 2026-10-12.\nYou wrote on 2026-10-12: Anchor again, but today it feels heavy.\n\nAn earlier time Anchor came up, on 2026-03-02.\nYou wrote on 2026-03-02: Relief. It felt like a hug.";

test("every mode has its own job in the prompt, its own ask, and the same safety lines", () => {
  const jobs = MODEL_MODES.map((m) => companionSystemPrompt("Ember", false, m));
  assert.equal(new Set(jobs).size, MODEL_MODES.length);
  for (const p of jobs) {
    assert.match(p, /^You are Ember, /);
    assert.match(p, /Never state what will happen as a fact/);
    assert.match(p, /crisis/);
  }
  assert.match(companionSystemPrompt("C", false, "reading"), /Going only by your own words/);
  assert.match(companionSystemPrompt("C", false, "scene"), /numbered 1\., 2\., 3\./);
  assert.match(askMessage("X", "reading"), /reading from my words/);
  assert.match(askMessage("X", "scene"), /picture/);
  // The default is questions, and the gentle note is added in any mode.
  assert.equal(companionSystemPrompt("C"), companionSystemPrompt("C", false, "questions"));
  assert.match(companionSystemPrompt("C", true, "reading"), /chose to carry on/);
});

test("a reading from the person's words must not predict, judge, or run too long", () => {
  const ok = "Going only by your own words, the Anchor was once a hug and is now heavy, and you wrote that it stops you moving. You might look at what it holds in place. What do you notice in that?";
  assert.equal(usable("reading", ok, HISTORY_CTX), true);
  assert.equal(usable("reading", ok + " He will come back soon.", HISTORY_CTX), false);
  assert.equal(usable("reading", "Going only by your own words, wise choice.", HISTORY_CTX), false); // too short
  assert.equal(usable("reading", "word ".repeat(300), HISTORY_CTX), false);
});

test("picture ideas must be numbered, concrete lines", () => {
  assert.equal(usable("scene", "1. A bramble by a back door at dusk, thorns catching a torn sleeve\n2. A small grey stone on wet sand, tide lines around it\n3. A pale hand lifting a thorn from cloth in low light", "x"), true);
  assert.equal(usable("scene", "Here are ideas.\n1. A thorn\n2. A door", "x"), false); // too short each
  assert.equal(usable("scene", "A bramble by a back door at dusk, thorns catching a torn sleeve.", "x"), false); // not numbered
});

test("each mode answers through the same safety path, and any reply that is not questions is a 'reply'", async () => {
  const text = "Going only by your own words, the Anchor was once a hug and is now heavy, and you wrote that it stops you moving. You might look at what it holds in place. What do you notice in that?";
  const m = fake("NO", text);
  const out = await runCompanion({ context: ORDINARY, name: "Ember", acknowledged: false, ask: m.ask, mode: "reading" });
  assert.equal(out.action, "reply");
  assert.equal(m.calls.length, 2); // the risk check, then the reading
  assert.match(m.calls[1][0].content, /Going only by your own words/);
  assert.match(m.calls[1][1].content, /Offer a reading from my words/);
  // A crisis is answered without any model call in every mode.
  for (const mode of MODEL_MODES) {
    const n = fake("NO");
    const c = await runCompanion({ context: EXPLICIT, name: "Companion", acknowledged: false, ask: n.ask, mode });
    assert.equal(c.action, "crisis", mode);
    assert.equal(n.calls.length, 0, mode);
  }
});

test("a mode whose replies keep failing is an honest error, unless worrying words were the cause", async () => {
  const bad = fake("NO", "Nothing useful here.");
  await assert.rejects(runCompanion({ context: ORDINARY, name: "Companion", acknowledged: false, ask: bad.ask, mode: "scene" }), /usable scene reply/);
  assert.equal(bad.calls.length, 1 + 3); // the risk check and three tries
});
