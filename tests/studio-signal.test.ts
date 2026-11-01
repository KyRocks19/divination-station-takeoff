import { test } from "node:test";
import assert from "node:assert/strict";
import { ALIVE_KEY, WAKE_LIST, pipelineRequest, pushWake, redisRest, studioAliveFromRedis, wakeCommands } from "../lib/studio-signal";

const rest = { url: "https://example.upstash.io", token: "tok" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

test("redisRest needs an https address and a token", () => {
  assert.equal(redisRest({}), null);
  assert.equal(redisRest({ UPSTASH_REDIS_REST_URL: "https://a.upstash.io" }), null);
  assert.equal(redisRest({ UPSTASH_REDIS_REST_URL: "http://a.upstash.io", UPSTASH_REDIS_REST_TOKEN: "t" }), null);
  assert.deepEqual(redisRest({ UPSTASH_REDIS_REST_URL: " https://a.upstash.io/ ", UPSTASH_REDIS_REST_TOKEN: " t " }), { url: "https://a.upstash.io", token: "t" });
});

test("the wake note is three commands in one pipeline with the bearer token", () => {
  assert.deepEqual(wakeCommands(), [["LPUSH", WAKE_LIST, "1"], ["LTRIM", WAKE_LIST, 0, 19], ["EXPIRE", WAKE_LIST, 3600]]);
  const { url, init } = pipelineRequest(rest, wakeCommands());
  assert.equal(url, "https://example.upstash.io/pipeline");
  assert.equal(init.method, "POST");
  assert.equal((init.headers as Record<string, string>).Authorization, "Bearer tok");
  assert.equal(JSON.parse(String(init.body)).length, 3);
});

test("pushWake reports success, refusal, and a dead network without throwing", async () => {
  assert.equal(await pushWake(rest, (async () => reply([{ result: 1 }])) as typeof fetch), true);
  assert.equal(await pushWake(rest, (async () => reply({ error: "bad" }, 401)) as typeof fetch), false);
  assert.equal(await pushWake(rest, (async () => { throw new Error("offline"); }) as typeof fetch), false);
});

test("studioAliveFromRedis: a value means awake, null means asleep, trouble means unknown", async () => {
  let asked = "";
  const get = (body: unknown, status = 200) => (async (u: string) => { asked = u; return reply(body, status); }) as unknown as typeof fetch;
  assert.equal(await studioAliveFromRedis(rest, get({ result: "1" })), true);
  assert.equal(asked, `https://example.upstash.io/get/${ALIVE_KEY}`);
  assert.equal(await studioAliveFromRedis(rest, get({ result: null })), false);
  assert.equal(await studioAliveFromRedis(rest, get({ error: "x" }, 500)), null);
  assert.equal(await studioAliveFromRedis(rest, (async () => { throw new Error("offline"); }) as typeof fetch), null);
  assert.equal(await studioAliveFromRedis(null), null);
});
