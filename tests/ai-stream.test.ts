import { test } from "node:test";
import assert from "node:assert/strict";
import { AI_MESSAGES, describeAiError, explainAiError } from "../lib/ai-log";
import { streamClaude } from "../lib/ai-stream";

/** What the Anthropic SDK throws for an HTTP error: a status and the parsed body. */
function apiError(status: number, type: string, message: string, requestID = "req_123") {
  return Object.assign(new Error(`${status} ${message}`), { status, error: { type: "error", error: { type, message } }, requestID });
}

const delta = (text: string) => ({ type: "content_block_delta", delta: { type: "text_delta", text } });

async function* events(items: unknown[], failAt?: { index: number; error: unknown }) {
  for (let i = 0; i < items.length; i++) {
    if (failAt && failAt.index === i) throw failAt.error;
    yield items[i];
  }
  if (failAt && failAt.index >= items.length) throw failAt.error;
}

test("the log line names the status, the kind of error, Anthropic's words, and the request, never a key", () => {
  const line = describeAiError(apiError(401, "authentication_error", "invalid x-api-key"));
  assert.equal(line, "HTTP 401 authentication_error invalid x-api-key (request req_123)");
  assert.equal(describeAiError(new TypeError("fetch failed")), "no HTTP answer TypeError fetch failed");
  assert.equal(describeAiError("boom"), "no HTTP answer boom");
});

test("each kind of failure gets a plain sentence for the person and a sensible status", () => {
  assert.deepEqual(explainAiError(apiError(401, "authentication_error", "invalid x-api-key")), { message: AI_MESSAGES.auth, status: 502 });
  assert.deepEqual(explainAiError(apiError(403, "permission_error", "no")), { message: AI_MESSAGES.auth, status: 502 });
  assert.deepEqual(explainAiError(apiError(429, "rate_limit_error", "slow down")), { message: AI_MESSAGES.busy, status: 429 });
  assert.equal(explainAiError(apiError(400, "invalid_request_error", "Your credit balance is too low")).message, AI_MESSAGES.limit);
  assert.equal(explainAiError(apiError(400, "invalid_request_error", "workspace spend limit reached")).message, AI_MESSAGES.limit);
  assert.equal(explainAiError(apiError(404, "not_found_error", "model: nope")).message, AI_MESSAGES.model);
  assert.deepEqual(explainAiError(apiError(529, "overloaded_error", "Overloaded")), { message: AI_MESSAGES.down, status: 503 });
  assert.deepEqual(explainAiError(new Error("connection reset")), { message: AI_MESSAGES.down, status: 503 });
  assert.equal(explainAiError(apiError(400, "invalid_request_error", "bad field")).message, AI_MESSAGES.other);
});

test("a good answer is sent as it arrives and handed to onDone", async () => {
  let saved = "";
  const res = await streamClaude(events([{ type: "message_start" }, delta("Hel"), delta("lo"), { type: "message_stop" }]), "test", async (t) => { saved = t; });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "text/plain; charset=utf-8");
  assert.equal(await res.text(), "Hello");
  assert.equal(saved, "Hello");
});

test("a refusal before any text becomes a plain error the page can show, not an empty 200", async () => {
  const errors: string[] = [];
  const original = console.error;
  console.error = (m: string) => errors.push(m);
  try {
    const res = await streamClaude(events([], { index: 0, error: apiError(401, "authentication_error", "invalid x-api-key") }), "sword");
    assert.equal(res.status, 502);
    const body = await res.json();
    assert.equal(body.error, AI_MESSAGES.auth);
    assert.equal(body.code, "ai_unavailable");
  } finally {
    console.error = original;
  }
  assert.deepEqual(errors, ["[ai] sword failed: HTTP 401 authentication_error invalid x-api-key (request req_123)"]);
});

test("an answer that stops part way keeps what was sent and logs why", async () => {
  const errors: string[] = [];
  const original = console.error;
  console.error = (m: string) => errors.push(m);
  let done = false;
  try {
    const res = await streamClaude(events([delta("Part"), delta("ial")], { index: 2, error: apiError(529, "overloaded_error", "Overloaded") }), "ask", async () => { done = true; });
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "Partial");
  } finally {
    console.error = original;
  }
  assert.equal(done, false, "a cut-off answer is not saved as if it were whole");
  assert.match(errors[0], /^\[ai\] ask failed: HTTP 529 overloaded_error Overloaded/);
});

test("a failure while saving does not take away the answer the person already read", async () => {
  const original = console.error;
  const errors: string[] = [];
  console.error = (m: string) => errors.push(m);
  try {
    const res = await streamClaude(events([delta("All of it")]), "interview", async () => { throw new Error("database down"); });
    assert.equal(await res.text(), "All of it");
  } finally {
    console.error = original;
  }
  assert.match(errors[0], /interview failed: .*database down/);
});

test("an answer with no text at all is not saved", async () => {
  let called = false;
  const res = await streamClaude(events([{ type: "message_start" }, { type: "message_stop" }]), "x", async () => { called = true; });
  assert.equal(await res.text(), "");
  assert.equal(called, false);
});
