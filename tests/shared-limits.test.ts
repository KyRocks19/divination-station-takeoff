import test from "node:test";
import assert from "node:assert/strict";
import { RETRY_AFTER_FAILURE_MS, bucketKey, countFrom, limiterCommands, makeLimiter } from "../lib/shared-limits";

const rest = { url: "https://example.upstash.io", token: "tok" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

test("a counter has its own key for each limiter, person and minute", () => {
  assert.equal(bucketKey("writes", "u5", 60_000, 120_000), "ds:rl:writes:u5:2");
  assert.notEqual(bucketKey("writes", "u5", 60_000, 120_000), bucketKey("writes", "u5", 60_000, 180_000));
  assert.notEqual(bucketKey("writes", "u5", 60_000, 0), bucketKey("claude", "u5", 60_000, 0));
});

test("each call is one INCR and one EXPIRE of twice the window", () => {
  assert.deepEqual(limiterCommands("k", 60_000), [["INCR", "k"], ["EXPIRE", "k", 120]]);
});

test("the count is read out of Upstash's answer, and nothing else is trusted", () => {
  assert.equal(countFrom([{ result: 3 }, { result: 1 }]), 3);
  assert.equal(countFrom([{ error: "x" }]), null);
  assert.equal(countFrom({ result: 3 }), null);
  assert.equal(countFrom([{ result: "3" }]), null);
});

test("with Redis, the count from Redis decides, so two servers share it", async () => {
  let n = 0;
  const fetchImpl = (async () => reply([{ result: ++n }, { result: 1 }])) as typeof fetch;
  const a = makeLimiter("t", 2, 60_000, { rest, fetchImpl, now: () => 0 });
  const b = makeLimiter("t", 2, 60_000, { rest, fetchImpl, now: () => 0 }); // another server, same Redis
  assert.deepEqual([await a.allow("u1"), await b.allow("u1"), await a.allow("u1")], [true, true, false]);
});

test("without Redis each server counts for itself", async () => {
  const l = makeLimiter("t", 2, 60_000, { rest: null, now: () => 0 });
  assert.deepEqual([await l.allow("u1"), await l.allow("u1"), await l.allow("u1"), await l.allow("u2")], [true, true, false, true]);
});

test("when Redis fails the limiter counts locally, and leaves Redis alone for a while", async () => {
  let calls = 0;
  let t = 0;
  const fetchImpl = (async () => { calls++; throw new Error("offline"); }) as typeof fetch;
  const l = makeLimiter("t", 2, 60_000, { rest, fetchImpl, now: () => t });
  assert.deepEqual([await l.allow("u1"), await l.allow("u1"), await l.allow("u1")], [true, true, false]);
  assert.equal(calls, 1); // only the first call tried Redis
  t = RETRY_AFTER_FAILURE_MS + 1;
  await l.allow("u9");
  assert.equal(calls, 2); // and it tries again later
});

test("a refusal from Redis (bad token) counts as a failure, not as permission", async () => {
  const l = makeLimiter("t", 1, 60_000, { rest, fetchImpl: (async () => reply({ error: "no" }, 401)) as typeof fetch, now: () => 0 });
  assert.deepEqual([await l.allow("u1"), await l.allow("u1")], [true, false]);
});
