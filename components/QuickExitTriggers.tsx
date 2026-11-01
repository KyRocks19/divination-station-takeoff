"use client";

import { useEffect } from "react";
import { quickExit } from "@/components/nav/logout";
import {
  EXIT_TRIGGERS_KEY,
  KEYS_WINDOW_MS,
  ShakeCounter,
  TwoFingerDoubleTap,
  exitTriggers,
  joltOf,
  type ExitAction,
} from "@/lib/quick-exit-core";

/** Tells a mounted QuickExitTriggers that Settings changed the choices, so they apply at once without a reload. */
export const EXIT_TRIGGERS_CHANGED = "ds-quick-exit-triggers-changed";

/** The iPhone's question for motion readings, asked only after the person touches the page (Safari refuses it otherwise). */
type MotionWithPermission = typeof DeviceMotionEvent & { requestPermission?: () => Promise<"granted" | "denied"> };

export async function askForMotion(): Promise<boolean> {
  if (typeof DeviceMotionEvent === "undefined") return false;
  const ask = (DeviceMotionEvent as MotionWithPermission).requestPermission;
  if (typeof ask !== "function") return true;
  try {
    return (await ask()) === "granted";
  } catch {
    return false;
  }
}

/** Whether this Esc press closes something on the page, so it is not one of the two presses of the quick exit. A text box does not count: Esc Esc while writing still locks. */
function escapeIsUsed(e: KeyboardEvent): boolean {
  if (e.defaultPrevented) return true;
  return !!document.querySelector("dialog[open], [aria-haspopup][aria-expanded=true]");
}

/**
 * The ways to set off the quick exit, besides the Exit button (lib/quick-exit-core.ts, chosen in Settings on this device): Esc pressed twice, two
 * fingers tapped twice, a hard shake, and leaving the tab (which is what the home and power buttons of a phone do to a page). Each one locks, stops
 * the app, or is off. Mounted once, in the header of every signed-in page. Draws nothing.
 */
export default function QuickExitTriggers({ canStop }: { canStop: boolean }) {
  useEffect(() => {
    let cleanup: (() => void) | null = null;

    const start = () => {
      cleanup?.();
      let stored: string | null = null;
      try {
        stored = window.localStorage.getItem(EXIT_TRIGGERS_KEY);
      } catch {
        // Defaults: Esc twice locks.
      }
      const t = exitTriggers(stored, canStop);
      const fire = (action: ExitAction) => {
        if (action !== "off") quickExit(action);
      };
      const offs: (() => void)[] = [];
      const on = <E extends Event>(target: EventTarget, type: string, fn: (e: E) => void, opts?: AddEventListenerOptions) => {
        target.addEventListener(type, fn as EventListener, opts);
        offs.push(() => target.removeEventListener(type, fn as EventListener, opts));
      };

      if (t.keys !== "off") {
        let last = 0;
        on<KeyboardEvent>(window, "keydown", (e) => {
          if (e.key !== "Escape") return;
          // An Esc that closes something (a dialog, a menu, the drawer, the search window) is for that, and does not count. Keyboard and
          // screen-reader users press Esc twice to close a menu inside the drawer; that must not lock the app (accessibility run, 2026-10-23).
          if (escapeIsUsed(e)) {
            last = 0;
            return;
          }
          const now = Date.now();
          if (now - last < KEYS_WINDOW_MS) fire(t.keys);
          last = now;
        });
      }

      if (t.tap !== "off") {
        const tap = new TwoFingerDoubleTap();
        const begun = new Map<number, { x: number; y: number }>();
        on<TouchEvent>(window, "touchstart", (e) => {
          for (const touch of Array.from(e.changedTouches)) begun.set(touch.identifier, { x: touch.clientX, y: touch.clientY });
          tap.down(e.touches.length, e.timeStamp);
        }, { passive: true });
        on<TouchEvent>(window, "touchmove", (e) => {
          for (const touch of Array.from(e.changedTouches)) {
            const b = begun.get(touch.identifier);
            if (b) tap.move(Math.hypot(touch.clientX - b.x, touch.clientY - b.y));
          }
        }, { passive: true });
        const up = (e: TouchEvent) => {
          for (const touch of Array.from(e.changedTouches)) begun.delete(touch.identifier);
          if (tap.up(e.touches.length, e.timeStamp)) fire(t.tap);
        };
        on(window, "touchend", up, { passive: true });
        on<TouchEvent>(window, "touchcancel", (e) => {
          tap.move(Infinity);
          up(e);
        }, { passive: true });
      }

      if (t.shake !== "off" && typeof DeviceMotionEvent !== "undefined") {
        const shake = new ShakeCounter();
        on<DeviceMotionEvent>(window, "devicemotion", (e) => {
          if (shake.push(joltOf(e.acceleration, e.accelerationIncludingGravity), e.timeStamp)) fire(t.shake);
        });
        // An iPhone gives no readings until it has asked; Safari lets the page ask only from a touch, so the first touch asks (once).
        if (typeof (DeviceMotionEvent as MotionWithPermission).requestPermission === "function") {
          on(window, "touchend", () => void askForMotion(), { once: true, passive: true });
        }
      }

      if (t.leave !== "off") {
        // Choosing a file or a photo, or printing, also hides the page on a phone; those are not leaving.
        let picking = false;
        on(document, "click", (e) => {
          if (e.target instanceof HTMLInputElement && e.target.type === "file") picking = true;
        }, { capture: true });
        on(window, "focus", () => (picking = false));
        on(document, "change", () => (picking = false), { capture: true });
        let printing = false;
        on(window, "beforeprint", () => (printing = true));
        on(window, "afterprint", () => (printing = false));
        on(document, "visibilitychange", () => {
          if (document.visibilityState === "hidden" && !picking && !printing) fire(t.leave);
        });
      }

      cleanup = () => offs.forEach((off) => off());
    };

    start();
    const restart = () => start();
    window.addEventListener(EXIT_TRIGGERS_CHANGED, restart);
    window.addEventListener("storage", restart);
    return () => {
      cleanup?.();
      window.removeEventListener(EXIT_TRIGGERS_CHANGED, restart);
      window.removeEventListener("storage", restart);
    };
  }, [canStop]);

  return null;
}
