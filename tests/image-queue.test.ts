import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DAILY_PICTURES, MAX_ACTIVE_PER_USER, MAX_UNCOLLECTED_PER_USER, cleanJobInput, dailyPictureLimit, imageMode, parseHeartbeat, studioAwake } from "../lib/image-queue";
import { MAX_BATCH } from "../lib/art-maker";

test("pictures go through the queue unless this server has an image tool of its own", () => {
  assert.equal(imageMode({}), "queue");
  assert.equal(imageMode({ IMAGE_GEN_URL: "http://localhost:5001" }), "direct");
  assert.equal(imageMode({ IMAGE_GEN_URL: "  " }), "queue");
  assert.equal(imageMode({ IMAGE_GEN_URL: "http://localhost:5001", IMAGE_MODE: "queue" }), "queue");
  assert.equal(imageMode({ IMAGE_MODE: "direct" }), "direct");
  assert.equal(imageMode({ IMAGE_MODE: "nonsense" }), "queue");
});

test("a person's own picture limit wins, then the setting, then 30", () => {
  assert.equal(dailyPictureLimit(5, "50"), 5);
  assert.equal(dailyPictureLimit(0, "50"), 0);
  assert.equal(dailyPictureLimit(null, "50"), 50);
  assert.equal(dailyPictureLimit(undefined, undefined), DEFAULT_DAILY_PICTURES);
  assert.equal(dailyPictureLimit(null, "many"), DEFAULT_DAILY_PICTURES);
});

test("a request for pictures needs words, a real form, and a sensible count", () => {
  const ok = cleanJobInput({ prompt: "  a red door  ", form: "stones", count: 3, card_id: 12 });
  assert.ok(ok.ok && ok.input.prompt === "a red door" && ok.input.form === "stones" && ok.input.count === 3 && ok.input.cardId === 12);
  const plain = cleanJobInput({ prompt: "x" });
  assert.ok(plain.ok && plain.input.form === "cards" && plain.input.count === 1 && plain.input.cardId === null);
  assert.ok(!cleanJobInput({ prompt: "   " }).ok);
  assert.ok(!cleanJobInput(null).ok);
  assert.ok(!cleanJobInput({ prompt: "x".repeat(5000) }).ok);
  assert.ok(!cleanJobInput({ prompt: "x", form: "spoons" }).ok);
  assert.ok(!cleanJobInput({ prompt: "x", card_id: -4 }).ok);
  assert.ok(!cleanJobInput({ prompt: "x", card_id: "abc" }).ok);
  // A count that makes no sense becomes the default batch rather than an error.
  const odd = cleanJobInput({ prompt: "x", count: 500 });
  assert.ok(odd.ok && odd.input.count >= 1 && odd.input.count <= MAX_BATCH);
  const biggest = cleanJobInput({ prompt: "x", count: MAX_BATCH });
  assert.ok(biggest.ok && biggest.input.count === MAX_BATCH);
});

test("the queue's limits follow the biggest batch, so changing MAX_BATCH changes them all together", () => {
  assert.equal(MAX_ACTIVE_PER_USER, MAX_BATCH, "a whole batch can wait at once");
  assert.equal(MAX_UNCOLLECTED_PER_USER, MAX_BATCH * 2, "two batches can sit uncollected");
  assert.ok(MAX_UNCOLLECTED_PER_USER >= MAX_ACTIVE_PER_USER);
});

test("the studio counts as awake only while its last check-in is recent enough for its own rhythm", () => {
  const now = new Date("2026-10-13T12:00:00Z");
  const at = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * 60_000).toISOString();
  assert.equal(studioAwake(null, now), false);
  assert.equal(studioAwake({ at: at(5), pollSeconds: 600 }, now), true); // checks every 10 minutes
  assert.equal(studioAwake({ at: at(15), pollSeconds: 600 }, now), true); // 15 minutes: within one and a half rounds plus a minute
  assert.equal(studioAwake({ at: at(40), pollSeconds: 600 }, now), false);
  assert.equal(studioAwake({ at: at(3), pollSeconds: 30 }, now), false); // a studio that checks every 30 s and has been silent 3 min
  assert.equal(studioAwake({ at: new Date(0).toISOString(), pollSeconds: 600 }, now), false); // stopped on purpose
});

test("a heartbeat that cannot be read counts as no heartbeat", () => {
  assert.deepEqual(parseHeartbeat('{"at":"2026-10-13T12:00:00Z","pollSeconds":600}'), { at: "2026-10-13T12:00:00Z", pollSeconds: 600 });
  assert.equal(parseHeartbeat(null), null);
  assert.equal(parseHeartbeat("not json"), null);
  assert.equal(parseHeartbeat('{"at":"yesterday","pollSeconds":600}'), null);
  assert.equal(parseHeartbeat('{"at":"2026-10-13T12:00:00Z"}'), null);
});

import { ArtBudgetError, dbBudgetBytes, withinBudget } from "../lib/art-store";

test("each person has a share of the database for pictures, 25 MB unless set", () => {
  assert.equal(dbBudgetBytes(undefined), 25_000_000);
  assert.equal(dbBudgetBytes("10"), 10_000_000);
  assert.equal(dbBudgetBytes("0"), 0);
  assert.equal(dbBudgetBytes("lots"), 25_000_000);
  assert.equal(withinBudget(24_000_000, 1_000_000, 25_000_000), true);
  assert.equal(withinBudget(24_000_001, 1_000_000, 25_000_000), false);
  assert.match(new ArtBudgetError(25_000_000).message, /25 MB of picture space/);
});
