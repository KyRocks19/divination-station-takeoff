import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanComputerName, MAX_CIRCLE_TOKENS, MAX_NAME } from "../lib/worker-tokens";
import { CIRCLE_PROBLEMS, MAX_CIRCLE_COMPUTERS } from "../lib/circles-core";
import { readFileSync } from "node:fs";
import path from "node:path";

test("a circle's computer name is tidied and must be 1 to 60 characters", () => {
  assert.equal(cleanComputerName("  Kitchen   laptop "), "Kitchen laptop");
  assert.equal(cleanComputerName(""), null);
  assert.equal(cleanComputerName("   "), null);
  assert.equal(cleanComputerName(7), null);
  assert.equal(cleanComputerName("x".repeat(MAX_NAME + 1)), null);
  assert.equal(cleanComputerName("x".repeat(MAX_NAME))?.length, MAX_NAME);
});

test("the number the browser is told and the number the server enforces are the same", () => {
  assert.equal(MAX_CIRCLE_COMPUTERS, MAX_CIRCLE_TOKENS);
  assert.match(CIRCLE_PROBLEMS.too_many_computers.error, new RegExp(String(MAX_CIRCLE_TOKENS)));
});

test("a circle's picture token can never take companion requests: the database says so", () => {
  const sql = readFileSync(path.join(process.cwd(), "migrations", "066_circle_picture_computer.sql"), "utf8");
  assert.match(sql, /CHECK \(circle_id IS NULL OR can_companion = 0\)/);
});

test("each queue is separate: the claim only looks at its own circle's pictures", () => {
  const src = readFileSync(path.join(process.cwd(), "lib", "image-queue.ts"), "utf8");
  assert.match(src, /j\.circle_id IS NOT DISTINCT FROM \$2::int/);
  // The line in front of each person's waiting picture counts only the same queue.
  assert.match(src, /o\.circle_id IS NOT DISTINCT FROM j\.circle_id/);
});

test("the worker routes pass the token's circle on, so a studio cannot choose another queue", () => {
  const claim = readFileSync(path.join(process.cwd(), "app", "api", "worker", "pictures", "claim", "route.ts"), "utf8");
  assert.match(claim, /claimNext\(worker\.id, worker\.circleId\)/);
  const hb = readFileSync(path.join(process.cwd(), "app", "api", "worker", "heartbeat", "route.ts"), "utf8");
  assert.match(hb, /worker\.circleId/);
});
