import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_REVEAL_WAIT, REVEAL_WAIT_CHOICES, parseRevealWait } from "../lib/reveal-wait-core";

test("the choices run from 30 seconds to five minutes, in order", () => {
  const s = REVEAL_WAIT_CHOICES.map((c) => c.seconds);
  assert.equal(s[0], 30);
  assert.equal(s[s.length - 1], 300);
  assert.deepEqual([...s].sort((a, b) => a - b), s);
  assert.ok(s.includes(DEFAULT_REVEAL_WAIT));
});

test("a stored choice is read back; anything else is the default", () => {
  assert.equal(parseRevealWait("120"), 120);
  assert.equal(parseRevealWait("300"), 300);
  for (const bad of [null, undefined, "", "45", "abc", "600", "-30"]) assert.equal(parseRevealWait(bad), DEFAULT_REVEAL_WAIT);
});
