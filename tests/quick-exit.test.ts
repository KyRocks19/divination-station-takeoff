// Checks on the quick exit's snake game (docs/plan-feathered-edition.md 4.5). Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  DEFAULT_EXIT_TRIGGERS,
  SHAKE_GAP_MS,
  SHAKE_JOLT,
  SNAKE_PATH,
  ShakeCounter,
  TwoFingerDoubleTap,
  exitTriggers,
  joltOf,
  quickExitTarget,
  safeBackPath,
  showsGameWhenLocked,
  snakeLook,
} from "../lib/quick-exit-core";
import { snakePage } from "../lib/snake-page";

const root = path.join(__dirname, "..");
const read = (f: string) => readFileSync(path.join(root, f), "utf8");

test("the quick exit goes to the game, unless this device chose the weather search; Feathered always goes to the game", () => {
  assert.equal(quickExitTarget(null, false), "snake");
  assert.equal(quickExitTarget("weather", false), "weather");
  assert.equal(quickExitTarget("something", false), "snake");
  assert.equal(quickExitTarget("weather", true), "snake");
  assert.equal(snakeLook(null), "hekate");
  assert.equal(snakeLook("plain"), "plain");
  assert.equal(snakeLook("x"), "hekate");
});

test("while locked, every page is the game, but the game, its files, the API and the app's own files still load", () => {
  for (const p of ["/", "/readings/3", "/login", "/settings", "/privacy", "/help", "/snakes", "/cards/1.jpg"]) assert.ok(showsGameWhenLocked(p), p);
  for (const p of [SNAKE_PATH, "/snake/game.js", "/snake/game.css", "/api/snake/score", "/api/auth/quick-exit", "/_next/static/x.js", "/favicon.ico"]) {
    assert.ok(!showsGameWhenLocked(p), p);
  }
});

test("the page to go back to is an address on this app only", () => {
  assert.equal(safeBackPath("/readings/4?tab=journals"), "/readings/4?tab=journals");
  for (const bad of ["https://evil.example", "//evil.example", "/\\evil", "readings", "", 5, null, "/snake", "/snake?x=1", "/a\nb", "/" + "x".repeat(400)]) {
    assert.equal(safeBackPath(bad), "/", String(bad));
  }
});

test("the game's page has nothing of the app on it and loads nothing from elsewhere", () => {
  const html = snakePage("abc123+/=");
  assert.match(html, /<title>Snake<\/title>/);
  assert.doesNotMatch(html, /Divination|Hekate|tarot|oracle/i);
  assert.doesNotMatch(html, /style="/);
  assert.match(html, /<script nonce="abc123\+\/=" src="\/snake\/game\.js"><\/script>/);
  // Every address on the page is this server's or a drawn icon; the SVG namespace is a name, not a request.
  const addresses = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  for (const a of addresses) assert.ok(a.startsWith("/snake/") || a.startsWith("data:image/svg+xml,"), a);
  assert.equal(snakePage('x"><script>').includes('"><script>'), false, "the nonce cannot break out of its attribute");
});

test("the game script asks only this server, keeps no names, and shows only initials", () => {
  const js = read("public/snake/game.js");
  assert.deepEqual([...js.matchAll(/fetch\("([^"]+)"/g)].map((m) => m[1]), ["/api/snake/score"]);
  assert.doesNotMatch(js, /https?:\/\//);
  assert.doesNotMatch(js, /localStorage\.setItem|sessionStorage|indexedDB|document\.cookie/);
  assert.match(js, /slice\(0, 3\)\.toUpperCase\(\)/);
  assert.match(js, /prefers-reduced-motion/);
});

test("the score route never stores a name and gives a wrong name the same answer as any score", () => {
  const route = read("app/api/snake/score/route.ts");
  assert.doesNotMatch(route, /\b(query|queryOne|withTransaction)\(/);
  assert.match(route, /recordLoginFailure/);
  assert.match(route, /isLoginLimited/);
  assert.equal((route.match(/return plain;/g) ?? []).length, 5);
});

test("the proxy shows the game to a locked browser before anything else, the sign-in page included", () => {
  const proxy = read("proxy.ts");
  const lock = proxy.indexOf("showsGameWhenLocked(pathname)");
  const open = proxy.indexOf("PUBLIC_PATHS.some(");
  assert.ok(lock > 0 && open > lock, "the lock check comes before the public pages are let through");
  assert.match(proxy, /peek\.decoy && !peek\.userId/);
});

test("the ways to set off the quick exit: Esc twice locks by default, the rest are off, and stop is only for a copy that can stop", () => {
  assert.deepEqual(exitTriggers(null, true), DEFAULT_EXIT_TRIGGERS);
  assert.deepEqual(exitTriggers("not json", true), DEFAULT_EXIT_TRIGGERS);
  assert.deepEqual(exitTriggers("[1,2]", true), DEFAULT_EXIT_TRIGGERS);
  const chosen = JSON.stringify({ keys: "off", tap: "stop", shake: "pause", leave: "explode", buzz: false });
  assert.deepEqual(exitTriggers(chosen, true), { keys: "off", tap: "stop", shake: "pause", leave: "off", buzz: false });
  // A stop chosen on another copy is a lock here, never nothing.
  assert.equal(exitTriggers(chosen, false).tap, "pause");
});

test("two fingers tapped twice sets it off; one finger, a slide, a slow press or a late second finger do not", () => {
  const tapTwice = (t: TwoFingerDoubleTap, start: number) => {
    t.down(1, start);
    t.down(2, start + 20);
    t.up(1, start + 100);
    const first = t.up(0, start + 110);
    t.down(1, start + 300);
    t.down(2, start + 310);
    t.up(1, start + 400);
    return [first, t.up(0, start + 410)];
  };
  assert.deepEqual(tapTwice(new TwoFingerDoubleTap(), 0), [false, true]);

  // Both fingers reported at once.
  const both = new TwoFingerDoubleTap();
  both.down(2, 0);
  assert.equal(both.up(0, 80), false);
  both.down(2, 300);
  assert.equal(both.up(0, 380), true);

  const one = new TwoFingerDoubleTap();
  for (const s of [0, 200, 400]) {
    one.down(1, s);
    assert.equal(one.up(0, s + 80), false);
  }

  const pinch = new TwoFingerDoubleTap();
  pinch.down(2, 0);
  pinch.move(80);
  pinch.up(0, 150);
  pinch.down(2, 300);
  assert.equal(pinch.up(0, 380), false, "a pinch is not a tap");

  const slow = new TwoFingerDoubleTap();
  slow.down(2, 0);
  slow.up(0, 900);
  slow.down(2, 1000);
  assert.equal(slow.up(0, 1080), false);

  const late = new TwoFingerDoubleTap();
  late.down(1, 0);
  late.down(2, 400);
  late.up(0, 450);
  late.down(2, 600);
  assert.equal(late.up(0, 650), false, "a resting finger and a tapping one are not two together");

  const apart = new TwoFingerDoubleTap();
  apart.down(2, 0);
  apart.up(0, 80);
  apart.down(2, 2000);
  assert.equal(apart.up(0, 2080), false, "two taps far apart are two single taps");
});

test("a hard shake sets it off; gentle movement and one bump do not", () => {
  assert.equal(joltOf({ x: 3, y: 4, z: 0 }, null), 5);
  assert.equal(joltOf({ x: null, y: null, z: null }, { x: 0, y: 0, z: 9.81 }), 0);
  assert.ok(Math.abs(joltOf(null, { x: 0, y: 0, z: 29.81 }) - 20) < 1e-9);
  assert.equal(joltOf(null, null), 0);

  const shake = new ShakeCounter();
  const hits = [0, 150, 300, 450].map((t) => shake.push(SHAKE_JOLT + 5, t));
  assert.deepEqual(hits, [false, false, false, true]);

  const gentle = new ShakeCounter();
  for (let t = 0; t < 3000; t += 20) assert.equal(gentle.push(SHAKE_JOLT - 4, t), false);

  const bump = new ShakeCounter();
  for (let t = 0; t < SHAKE_GAP_MS; t += 10) assert.equal(bump.push(SHAKE_JOLT * 2, t), false, "one bump, many readings, is one jolt");

  const slowJolts = new ShakeCounter();
  for (const t of [0, 1000, 2000, 3000]) assert.equal(slowJolts.push(SHAKE_JOLT + 5, t), false);
});

test("a quick exit that stops the app does so only for the administrator, from this computer, after locking", () => {
  const route = read("app/api/auth/quick-exit/route.ts");
  assert.match(route, /stop === true && session\.isAdmin === true && reachedOnThisComputer\(/);
  const lock = route.indexOf("await lockCopy()");
  const end = route.indexOf("await pool.end()");
  assert.ok(lock > 0 && end > lock, "the lock comes first, so a stop that fails still leaves the data locked");
  assert.ok(route.indexOf("const mayStop") < route.indexOf("session.isAdmin = undefined"), "who may stop is read before the sign-out");
});

test("the ways to set off the quick exit ask nothing of anyone: no request of their own, no address elsewhere", () => {
  for (const f of ["components/QuickExitTriggers.tsx", "components/QuickExitSettings.tsx"]) {
    const src = read(f);
    assert.doesNotMatch(src, /fetch\(|https?:\/\//, f);
  }
  const logout = read("components/nav/logout.ts");
  assert.match(logout, /navigator\.vibrate\(BUZZ_MS\)/);
});
