// Checks on the small shared helpers that every page leans on. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { BOARD_MAX, GRID_STEP_X, GRID_STEP_Y, cleanColor, snapToStep } from "../lib/layouts-shared";
import { cleanAngle, swingName } from "../lib/pendulum-swings";
import { toolOfPath, parseChosenTools, divinationPath, DIVINATION_KINDS } from "../lib/divination-kinds";
import { cleanTheme, parseTheme } from "../lib/theme";
import { createRng } from "../lib/rng";
import { loginKeys, clientIp, ipKey } from "../lib/login-limit";

test("cleanColor accepts six-digit hex only", () => {
  assert.equal(cleanColor(" #A855F7 "), "#a855f7");
  assert.equal(cleanColor("#fff"), null);
  assert.equal(cleanColor("red"), null);
  assert.equal(cleanColor("#12345g"), null);
  assert.equal(cleanColor(12), null);
});

test("the layout board's grid moves a card a quarter of its size, and stays on the board", () => {
  assert.equal(GRID_STEP_X, 24);
  assert.equal(GRID_STEP_Y, 42);
  assert.equal(snapToStep(228, GRID_STEP_X), 240);
  assert.equal(snapToStep(316, GRID_STEP_Y), 336);
  assert.equal(snapToStep(11, GRID_STEP_X), 0);
  assert.equal(snapToStep(-50, GRID_STEP_X), 0);
  assert.equal(snapToStep(BOARD_MAX + 100, GRID_STEP_X) % GRID_STEP_X, 0);
  assert.ok(snapToStep(BOARD_MAX + 100, GRID_STEP_Y) <= BOARD_MAX);
  assert.equal(snapToStep(7, 2), 8);
});

test("pendulum angles are 0 to 179.9 in steps of a tenth", () => {
  assert.equal(cleanAngle(0), 0);
  assert.equal(cleanAngle(179), 179);
  assert.equal(cleanAngle(180), null);
  assert.equal(cleanAngle(-1), null);
  assert.equal(cleanAngle(1.5), 1.5);
  assert.equal(cleanAngle(1.55), null);
  assert.equal(cleanAngle("90"), null);
  assert.equal(swingName({ shape: "line", angle: 0, builtin: 1 }), "Back and forth");
  assert.equal(swingName({ shape: "line", angle: 45, name: "  " }), "Line at 45°");
});

test("tool paths and chosen tools", () => {
  assert.equal(toolOfPath("/runes/set"), "runes");
  assert.equal(toolOfPath("/runesx"), null);
  assert.equal(toolOfPath("/readings"), null);
  assert.equal(parseChosenTools(null), null);
  assert.equal(parseChosenTools("runes,bogus")?.join(), "runes");
  assert.equal(parseChosenTools(DIVINATION_KINDS.join(",")), null);
  assert.equal(parseChosenTools("nothing,valid"), null);
  assert.ok(divinationPath("runes", 5).includes("5"));
});

test("themes keep only known tokens with hex colours", () => {
  assert.deepEqual(cleanTheme({ "color-canvas": "#112233", nonsense: "#ffffff" }), { "color-canvas": "#112233" });
  assert.deepEqual(cleanTheme({ "color-canvas": "url(javascript:alert(1))" }), {});
  assert.equal(parseTheme("not json"), null);
  assert.equal(parseTheme(""), null);
  assert.equal(parseTheme(JSON.stringify({ "color-canvas": "#112233" }))?.["color-canvas"], "#112233");
});

test("the random sources give numbers in [0, 1)", async () => {
  for (const method of ["math", "crypto"]) {
    const rng = await createRng(method);
    for (let i = 0; i < 200; i++) {
      const n = rng();
      assert.ok(n >= 0 && n < 1, `${method} gave ${n}`);
    }
  }
});

test("login keys ignore case and spacing; the address comes from the proxy headers", () => {
  assert.equal(loginKeys("1.2.3.4", "  Ky ").user, "user:ky");
  const h = new Headers({ "x-forwarded-for": "9.9.9.9, 8.8.8.8", "x-real-ip": "1.1.1.1" });
  assert.equal(clientIp(h), "1.1.1.1", "x-real-ip comes first");
  assert.equal(clientIp(new Headers({ "x-forwarded-for": "9.9.9.9, 8.8.8.8" })), "9.9.9.9");
  assert.equal(clientIp(new Headers()), "unknown");
});

test("the address kept for failed sign-ins is a keyed hash, never the address", () => {
  const key = ipKey("ip", "1.2.3.4", "secret-a");
  assert.match(key, /^ip:[0-9a-f]{32}$/);
  assert.ok(!key.includes("1.2.3.4"));
  assert.equal(key, ipKey("ip", "1.2.3.4", "secret-a"), "same address, same key");
  assert.notEqual(key, ipKey("ip", "1.2.3.5", "secret-a"), "different address, different key");
  assert.notEqual(key, ipKey("ip", "1.2.3.4", "secret-b"), "a different secret gives different keys, so a table of hashes does not help");
  assert.equal(loginKeys("1.2.3.4", "ky").ip, ipKey("ip", "1.2.3.4"));
  assert.ok(ipKey("join-ip", "1.2.3.4", "s").startsWith("join-ip:"));
});
