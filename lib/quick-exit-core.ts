// The quick exit's rules (owner decisions 2026-10-22, docs/plan-feathered-edition.md 4.5): pressing it locks the app and turns the tab into a small snake
// game. While this browser is locked that way, every page of the app shows the game, so Back, Refresh or a typed address show nothing else. The way back is
// the high-score name: typing the account's password (the passphrase) there unlocks; anything else is just a name on the table. No database and no imports,
// so the proxy, the browser and the tests use it.


/** Where the game is served: a whole page of its own (app/snake/route.ts), with none of the app's header, navigation or footer. */
export const SNAKE_PATH = "/snake";

/**
 * The neutral web page the quick exit used before the game (2026-10-22). Winged can still choose it in Settings; Feathered never goes online, and since
 * the value is fixed when the app is built, the address is not even in the Feathered build.
 */
export const WEATHER_URL = process.env.NEXT_PUBLIC_FEATHERED === "1" ? SNAKE_PATH : "https://www.google.com/search?q=weather";

/** Device settings kept in this browser only (localStorage): where the quick exit goes, and what the snake eats. */
export const QUICK_EXIT_TARGET_KEY = "ds-quick-exit";
export const SNAKE_LOOK_KEY = "ds-snake-look";

export type QuickExitTarget = "snake" | "weather";
export type SnakeLook = "hekate" | "plain";

/** Where the quick exit goes: the game unless this device chose the weather search, which the Feathered edition never offers. */
export function quickExitTarget(stored: string | null | undefined, feathered: boolean): QuickExitTarget {
  return !feathered && stored === "weather" ? "weather" : "snake";
}

/** What the snake eats: a little key and a little flame (the default), or an apple and a berry for someone who wants no hint at all. */
export function snakeLook(stored: string | null | undefined): SnakeLook {
  return stored === "plain" ? "plain" : "hekate";
}

/** Requests that still reach the app while it is locked by the quick exit: the game, its score, the app's own files. Every page is the game instead. */
export function showsGameWhenLocked(pathname: string): boolean {
  if (pathname === SNAKE_PATH || pathname.startsWith(`${SNAKE_PATH}/`)) return false;
  if (pathname.startsWith("/api/") || pathname.startsWith("/_next/")) return false;
  if (pathname === "/favicon.ico" || pathname === "/manifest.webmanifest" || pathname === "/sw.js") return false;
  return true;
}

/**
 * The page to go back to after unlocking: an address on this app only (a path that starts with one "/"), never the game itself and never anywhere else.
 * Anything doubtful goes to the home page.
 */
export function safeBackPath(value: unknown): string {
  if (typeof value !== "string" || value.length > 300) return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  if (/[\u0000-\u001f]/.test(value)) return "/";
  if (value === SNAKE_PATH || value.startsWith(`${SNAKE_PATH}?`) || value.startsWith(`${SNAKE_PATH}/`)) return "/";
  return value;
}

/** The longest high-score name the game takes: long enough for a passphrase, short enough to keep a request small. */
export const MAX_SCORE_NAME = 200;

// More ways to set off the quick exit (owner's request, 2026-10-22): each way can be off, can lock (the quick exit above, "the pause"), or, on a copy
// on the person's own computer, can stop the app the way "Stop and remove the drive" does. A web page is not given a phone's volume or power buttons
// on iPhone or Android, but pressing home or power hides the page, and that a page can see: "Leaving the tab" below. Kept on this device only.

export const EXIT_TRIGGERS_KEY = "ds-quick-exit-triggers";

/** The ways: Esc pressed twice, two fingers tapped twice, a hard shake, and leaving the tab (home or power button, another app, another tab). */
export type ExitTrigger = "keys" | "tap" | "shake" | "leave";
export type ExitAction = "off" | "pause" | "stop";

export interface ExitTriggers {
  keys: ExitAction;
  tap: ExitAction;
  shake: ExitAction;
  leave: ExitAction;
  /** One short buzz when the exit starts, on a phone that allows it (not iPhones; and only after a tap or key press, never a shake or leaving). */
  buzz: boolean;
}

export const EXIT_TRIGGER_NAMES: readonly ExitTrigger[] = ["keys", "tap", "shake", "leave"];

/** Esc twice locks, as it always has; the rest are off until the person turns them on, so nothing new fires by surprise. */
export const DEFAULT_EXIT_TRIGGERS: ExitTriggers = { keys: "pause", tap: "off", shake: "off", leave: "off", buzz: true };

/**
 * The stored choices, read safely: anything unknown keeps its default. Stopping is only possible on a copy on the person's own computer, for its
 * administrator; elsewhere a "stop" left over from another copy becomes a lock, never nothing.
 */
export function exitTriggers(stored: string | null | undefined, canStop: boolean): ExitTriggers {
  const out: ExitTriggers = { ...DEFAULT_EXIT_TRIGGERS };
  let raw: unknown = null;
  try {
    raw = stored ? JSON.parse(stored) : null;
  } catch {
    return out;
  }
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;
  for (const name of EXIT_TRIGGER_NAMES) {
    const v = r[name];
    if (v === "off" || v === "pause") out[name] = v;
    else if (v === "stop") out[name] = canStop ? "stop" : "pause";
  }
  if (typeof r.buzz === "boolean") out.buzz = r.buzz;
  return out;
}

/** How long the buzz lasts, and how long the page waits for it before leaving (a phone stops buzzing for a page that has gone). */
export const BUZZ_MS = 60;

/**
 * Two fingers tapped twice: two fingers down together, lifted quickly without sliding, twice within `TAP_WINDOW_MS`. A pinch or a two-finger scroll
 * moves, and one finger never counts, so reading and zooming do not set it off.
 */
export const TAP_WINDOW_MS = 600;
export const TAP_MAX_HOLD_MS = 350;
export const TAP_MAX_MOVE_PX = 24;
export const TAP_TOGETHER_MS = 150;

export class TwoFingerDoubleTap {
  private start = 0;
  private fingers = 0;
  private moved = false;
  private lastTap = -Infinity;

  /** A touch began; `touches` is how many fingers are on the screen now. */
  down(touches: number, t: number): void {
    if (this.fingers === 0) {
      this.start = t;
      this.moved = false;
      this.fingers = touches;
      return;
    }
    // The second finger must come down with the first, not later (a finger resting on the screen and a second tapping is not this).
    this.fingers = t - this.start <= TAP_TOGETHER_MS ? Math.max(this.fingers, touches) : Infinity;
  }

  /** A finger slid this far (in px) from where it began. */
  move(distance: number): void {
    if (distance > TAP_MAX_MOVE_PX) this.moved = true;
  }

  /** A finger lifted; `remaining` is how many are still on the screen. True when this completes the second two-finger tap. */
  up(remaining: number, t: number): boolean {
    if (remaining > 0) return false;
    const tap = this.fingers === 2 && !this.moved && t - this.start <= TAP_MAX_HOLD_MS;
    this.fingers = 0;
    if (!tap) {
      this.lastTap = -Infinity;
      return false;
    }
    if (t - this.lastTap <= TAP_WINDOW_MS) {
      this.lastTap = -Infinity;
      return true;
    }
    this.lastTap = t;
    return false;
  }
}

/**
 * A hard shake: `SHAKE_JOLTS` jolts above `SHAKE_JOLT` m/s² (gravity taken away) within `SHAKE_WINDOW_MS`, with at least `SHAKE_GAP_MS` between them so
 * one bump is one jolt. Walking, a bus or setting the phone down stays well under it.
 */
export const SHAKE_JOLT = 18;
export const SHAKE_JOLTS = 4;
export const SHAKE_WINDOW_MS = 1200;
export const SHAKE_GAP_MS = 90;
const GRAVITY = 9.81;

/** The strength of one motion reading: the acceleration without gravity when the device reports it, otherwise the reading with gravity taken off. */
export function joltOf(
  acceleration: { x: number | null; y: number | null; z: number | null } | null,
  withGravity: { x: number | null; y: number | null; z: number | null } | null,
): number {
  const size = (a: { x: number | null; y: number | null; z: number | null }) => Math.hypot(a.x ?? 0, a.y ?? 0, a.z ?? 0);
  if (acceleration && (acceleration.x !== null || acceleration.y !== null || acceleration.z !== null)) return size(acceleration);
  if (withGravity) return Math.abs(size(withGravity) - GRAVITY);
  return 0;
}

export class ShakeCounter {
  private jolts: number[] = [];

  /** One motion reading. True when it completes a shake. */
  push(jolt: number, t: number): boolean {
    if (jolt < SHAKE_JOLT) return false;
    const last = this.jolts[this.jolts.length - 1];
    if (last !== undefined && t - last < SHAKE_GAP_MS) return false;
    this.jolts = this.jolts.filter((j) => t - j <= SHAKE_WINDOW_MS);
    this.jolts.push(t);
    if (this.jolts.length >= SHAKE_JOLTS) {
      this.jolts = [];
      return true;
    }
    return false;
  }
}

/** Esc pressed twice within this long. */
export const KEYS_WINDOW_MS = 1000;
