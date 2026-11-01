"use client";

import { useEffect } from "react";

/**
 * Keeps keyboard and screen-reader focus from falling back to the start of the page. The accessibility run of 2026-10-23
 * found it happening all over the app, in three ways:
 * - The button just pressed turns itself off while it works ("Saving…", "Drawing…"). When it comes back on, it gets focus
 *   back. If it stays off (a "Save note" button is off again once its box is empty), focus goes to the box before it.
 * - What had focus was replaced (a form that becomes the saved result, a step that ends). Focus goes to the heading of the
 *   nearest part of the page that is still there, or to its first control.
 * - A move to another page inside the app (a reading saved, a draw made). Focus goes to the new page's heading.
 * It acts only when focus has fallen to <body>; it never takes focus from anything that has it.
 */
export default function FocusKeeper() {
  useEffect(() => {
    let last: HTMLElement | null = null;
    let ancestors: HTMLElement[] = [];
    let waitingSince = 0;
    let scheduled = false;

    function onFocusIn(e: FocusEvent) {
      if (!(e.target instanceof HTMLElement) || e.target === document.body) return;
      last = e.target;
      waitingSince = 0;
      ancestors = [];
      for (let el = e.target.parentElement; el && el !== document.body; el = el.parentElement) ancestors.push(el);
    }

    function settle() {
      scheduled = false;
      if (!last || !lost()) return;
      const el = last;
      if (el.isConnected && isDisabled(el)) {
        // Wait for it to come back on; give up after a moment and go to the field before it.
        if (!waitingSince) waitingSince = Date.now();
        window.setTimeout(() => {
          if (last === el && lost() && el.isConnected && isDisabled(el) && Date.now() - waitingSince >= 1400) {
            last = null;
            const field = fieldBefore(el);
            if (field) field.focus({ preventScroll: true });
          }
        }, 1500);
        return;
      }
      if (el.isConnected && !isDisabled(el)) {
        if (waitingSince) {
          waitingSince = 0;
          el.focus({ preventScroll: true });
        }
        return;
      }
      // Replaced: the nearest part of the page that is still there.
      last = null;
      const keep = ancestors.find((a) => a.isConnected) ?? document.getElementById("main");
      if (!keep) return;
      const target = headingIn(keep) ?? firstControlIn(keep) ?? headingIn(document.getElementById("main"));
      if (!target) return;
      if (!target.matches("a,button,input,select,textarea,[tabindex]")) {
        target.setAttribute("tabindex", "-1");
        target.setAttribute("data-route-focus", "");
      }
      target.focus({ preventScroll: true });
    }

    const observer = new MutationObserver(() => {
      if (scheduled || !last) return;
      scheduled = true;
      // After the framework has finished the change, so a component that moves focus itself goes first.
      window.setTimeout(settle, 30);
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["disabled"] });
    document.addEventListener("focusin", onFocusIn);
    return () => {
      observer.disconnect();
      document.removeEventListener("focusin", onFocusIn);
    };
  }, []);

  return null;
}

/** Focus is nowhere in particular: on <body>, or on nothing. */
function lost() {
  const a = document.activeElement;
  return !a || a === document.body || a === document.documentElement;
}

function isDisabled(el: HTMLElement) {
  return (el as HTMLButtonElement).disabled === true;
}

const CONTROLS = "a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])";

function visible(el: HTMLElement) {
  return el.getClientRects().length > 0;
}

function headingIn(root: HTMLElement | null): HTMLElement | null {
  if (!root) return null;
  return [...root.querySelectorAll<HTMLElement>("h1,h2,h3,h4")].find(visible) ?? null;
}

function firstControlIn(root: HTMLElement): HTMLElement | null {
  return [...root.querySelectorAll<HTMLElement>(CONTROLS)].find(visible) ?? null;
}

/** The text box or other control just before `el` in the page, inside the same form or section. */
function fieldBefore(el: HTMLElement): HTMLElement | null {
  const scope = el.closest<HTMLElement>("form,section,[role=region],fieldset,main") ?? document.body;
  const all = [...scope.querySelectorAll<HTMLElement>("input:not([type=hidden]):not([disabled]),textarea:not([disabled]),select:not([disabled])")].filter(visible);
  const before = all.filter((f) => f.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
  return before[before.length - 1] ?? null;
}
