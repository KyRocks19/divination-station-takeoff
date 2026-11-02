"use client";

import { useEffect, useSyncExternalStore } from "react";
import { COMFORT_ATTRIBUTES, COMFORT_KEY, DEFAULT_COMFORT, comfortAttributes, parseComfort, type Comfort } from "@/lib/comfort";

/**
 * The person's comfort and layout choices, shared by the "Reading comfort" and "Layout" cards in Settings so that a change in
 * one never undoes a change in the other (both are one record, `users.comfort`, and one copy in this browser). The choices
 * are read from the account when the first card appears, and from this browser when the account has none. The first render
 * is always the standard one, so nothing depends on the browser at first paint.
 */

export type ComfortMode = "account" | "device";

interface ComfortState {
  comfort: Comfort;
  /** "account": every change is also saved in the account. "device": only in this browser. */
  mode: ComfortMode;
  /** False when this browser refuses to store anything (a private window can). */
  storable: boolean;
}

const INITIAL: ComfortState = { comfort: DEFAULT_COMFORT, mode: "account", storable: true };

let state: ComfortState = INITIAL;
const listeners = new Set<() => void>();
let loading: AbortController | null = null;
/** How many cards are on the page now. */
let mounted = 0;

function set(patch: Partial<ComfortState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Reads what is saved, once while any card is on the page; it is read again when Settings is opened again. */
function load() {
  if (loading) return;
  let device: Comfort = DEFAULT_COMFORT;
  try {
    device = parseComfort(localStorage.getItem(COMFORT_KEY));
  } catch {
    set({ storable: false });
  }
  const ctrl = new AbortController();
  loading = ctrl;
  fetch("/api/comfort", { signal: ctrl.signal })
    .then((res) => (res.ok ? (res.json() as Promise<{ comfort: Comfort | null }>) : null))
    .then((data) => {
      if (data?.comfort) {
        // The account has choices: they win, and the page was drawn with them already.
        set({ comfort: parseComfort(JSON.stringify(data.comfort)), mode: "account" });
      } else {
        // Someone who chose things on this device before stays device-only until they decide.
        set({ comfort: device, mode: JSON.stringify(device) === JSON.stringify(DEFAULT_COMFORT) ? "account" : "device" });
      }
    })
    .catch(() => {
      if (!ctrl.signal.aborted) set({ comfort: device });
    });
}

function stopLoading() {
  loading?.abort();
  loading = null;
}

/** Puts the choices on <html> now, the same attributes the head script sets before the first paint. */
function applyToPage(c: Comfort) {
  const root = document.documentElement;
  for (const a of COMFORT_ATTRIBUTES) root.removeAttribute(a);
  for (const [k, v] of Object.entries(comfortAttributes(c))) root.setAttribute(k, v);
}

function keepOnDevice(next: Comfort): boolean {
  try {
    if (Object.keys(comfortAttributes(next)).length === 0) localStorage.removeItem(COMFORT_KEY);
    else localStorage.setItem(COMFORT_KEY, JSON.stringify(next));
    set({ storable: true });
    return true;
  } catch {
    set({ storable: false });
    return false;
  }
}

/** Saves in the account. Returns the line to show. */
async function keepInAccount(next: Comfort): Promise<string> {
  const res = await fetch("/api/comfort", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ comfort: next }),
  }).catch(() => null);
  return res?.ok
    ? "Saved in your account. It applies to every page, on every device you sign in on."
    : "Saved on this device. It could not be saved in your account just now; try again in a moment.";
}

/** Changes some choices, keeping the rest as they are now. Returns the line to show beside the card that changed. */
async function change(patch: Partial<Comfort>): Promise<string> {
  const next = { ...state.comfort, ...patch };
  set({ comfort: next });
  applyToPage(next);
  const onDevice = keepOnDevice(next);
  if (state.mode === "account") return keepInAccount(next);
  return onDevice ? "Saved on this device. It applies to every page here." : "";
}

/** Moves the choices into the account, or back to this device only. Returns the line to show. */
async function chooseMode(to: ComfortMode): Promise<string> {
  set({ mode: to });
  if (to === "account") return keepInAccount(state.comfort);
  const res = await fetch("/api/comfort", { method: "DELETE" }).catch(() => null);
  return res?.ok ? "Kept on this device only. Other devices are not changed." : "That did not work just now; try again in a moment.";
}

export function useComfort() {
  const s = useSyncExternalStore(subscribe, () => state, () => INITIAL);
  useEffect(() => {
    mounted += 1;
    load();
    return () => {
      mounted -= 1;
      // The last card has gone: read afresh next time, in case another device changed something.
      if (mounted === 0) stopLoading();
    };
  }, []);
  return { ...s, change, chooseMode };
}
