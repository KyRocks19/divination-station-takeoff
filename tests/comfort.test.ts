import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { COMFORT_BOOT_SCRIPT, COMFORT_KEY, DEFAULT_COMFORT, comfortAttributes, parseComfort } from "../lib/comfort";

test("nothing stored, or something unreadable, gives the standard page", () => {
  assert.deepEqual(parseComfort(null), DEFAULT_COMFORT);
  assert.deepEqual(parseComfort(""), DEFAULT_COMFORT);
  assert.deepEqual(parseComfort("{not json"), DEFAULT_COMFORT);
  assert.deepEqual(parseComfort("42"), DEFAULT_COMFORT);
  assert.deepEqual(parseComfort("null"), DEFAULT_COMFORT);
});

test("known choices are kept, unknown ones fall back one by one", () => {
  assert.deepEqual(parseComfort(JSON.stringify({ font: "lexend", size: 130, spacing: "roomy", motion: "less" })), {
    font: "lexend",
    size: 130,
    spacing: "roomy",
    motion: "less",
    header: "sticky",
  });
  assert.equal(parseComfort(JSON.stringify({ header: "scrolls" })).header, "scrolls");
  assert.deepEqual(parseComfort(JSON.stringify({ font: "comic", size: 99, spacing: "huge", motion: "none", header: "fixed" })), DEFAULT_COMFORT);
  assert.equal(parseComfort(JSON.stringify({ font: "atkinson", size: "150" })).size, 100, "a size must be a number");
  assert.equal(parseComfort(JSON.stringify({ font: "atkinson" })).font, "atkinson");
});

test("the standard choices set no attribute at all", () => {
  assert.deepEqual(comfortAttributes(DEFAULT_COMFORT), {});
  assert.deepEqual(comfortAttributes({ font: "opendyslexic", size: 150, spacing: "roomy", motion: "less", header: "scrolls" }), {
    "data-font": "opendyslexic",
    "data-size": "150",
    "data-spacing": "roomy",
    "data-motion": "less",
    "data-header": "scrolls",
  });
});

/** Runs the head script against a pretend page and returns the attributes it set. */
function runBoot(stored: string | null, storageThrows = false): Record<string, string> {
  const set: Record<string, string> = {};
  const sandbox = {
    localStorage: {
      getItem: (k: string) => {
        if (storageThrows) throw new Error("blocked");
        return k === COMFORT_KEY ? stored : null;
      },
    },
    document: { documentElement: { setAttribute: (k: string, v: string) => (set[k] = v) } },
  };
  vm.runInNewContext(COMFORT_BOOT_SCRIPT, sandbox);
  return set;
}

test("the head script and the parser agree on every kind of stored value", () => {
  const samples = [
    null,
    "{bad",
    "null",
    "7",
    JSON.stringify({}),
    JSON.stringify({ font: "atkinson" }),
    JSON.stringify({ font: "lexend", size: 115 }),
    JSON.stringify({ font: "opendyslexic", size: 150, spacing: "roomy", motion: "less" }),
    JSON.stringify({ font: "nope", size: 120, spacing: "x", motion: "y" }),
    JSON.stringify({ header: "scrolls" }),
    JSON.stringify({ header: "sticky", motion: "less" }),
    JSON.stringify({ header: "x" }),
  ];
  for (const s of samples) assert.deepEqual(runBoot(s), comfortAttributes(parseComfort(s)), String(s));
});

test("when storage is blocked the head script does nothing and does not throw", () => {
  assert.deepEqual(runBoot(JSON.stringify({ font: "lexend" }), true), {});
});
