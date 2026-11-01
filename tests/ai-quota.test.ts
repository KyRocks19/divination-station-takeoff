import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DAILY_LIMIT, DEFAULT_GLOBAL_DAILY_LIMIT, dailyLimit, globalDailyLimit, limitMessage, quotaTimeZone } from "../lib/ai-quota";

test("a person's own limit wins, then the setting, then 15", () => {
  assert.equal(dailyLimit(5, "20"), 5);
  assert.equal(dailyLimit(0, "20"), 0); // 0 switches Claude help off
  assert.equal(dailyLimit(null, "20"), 20);
  assert.equal(dailyLimit(undefined, undefined), DEFAULT_DAILY_LIMIT);
  assert.equal(dailyLimit(null, "lots"), DEFAULT_DAILY_LIMIT);
  assert.equal(dailyLimit(-3, ""), DEFAULT_DAILY_LIMIT);
  assert.equal(dailyLimit(null, "-1"), DEFAULT_DAILY_LIMIT);
});

test("the limit for everybody together has a default and can be set", () => {
  assert.equal(globalDailyLimit(undefined), DEFAULT_GLOBAL_DAILY_LIMIT);
  assert.equal(globalDailyLimit("50"), 50);
  assert.equal(globalDailyLimit("x"), DEFAULT_GLOBAL_DAILY_LIMIT);
});

test("the quota's time zone must be a real one", () => {
  assert.equal(quotaTimeZone(undefined), "UTC");
  assert.equal(quotaTimeZone("America/New_York"), "America/New_York");
  assert.equal(quotaTimeZone("Not/AZone"), "UTC");
});

test("each limit message says what happened and when it ends, without blaming", () => {
  assert.match(limitMessage("day", 15), /15 Claude requests for today.*midnight/);
  assert.match(limitMessage("everyone", 0), /midnight/);
  assert.match(limitMessage("minute", 6), /moment/);
  assert.match(limitMessage("off", 0), /switched off/);
});

test("the circle's limit messages say what ended and when it comes back", () => {
  assert.match(limitMessage("circleMember", 15), /15 Claude requests through your circle.*midnight/);
  assert.match(limitMessage("circleAll", 0), /circle has used its Claude requests.*midnight/);
});
