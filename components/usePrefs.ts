"use client";

import { useEffect, useState } from "react";
import { DEFAULT_PREFS, type Prefs } from "@/lib/prefs-shared";

let cached: Prefs | null = null;
let pending: Promise<Prefs> | null = null;
const listeners = new Set<(p: Prefs) => void>();

function load(): Promise<Prefs> {
  pending ??= fetch("/api/prefs")
    .then((r) => (r.ok ? r.json() : DEFAULT_PREFS))
    .catch(() => DEFAULT_PREFS)
    .then((p: Prefs) => (cached = p));
  return pending;
}

/** The signed-in user's display preferences. Returns the defaults until the first load finishes. */
export function usePrefs(): Prefs {
  const [prefs, setPrefs] = useState<Prefs>(cached ?? DEFAULT_PREFS);
  useEffect(() => {
    let active = true;
    load().then((p) => { if (active) setPrefs(p); });
    listeners.add(setPrefs);
    return () => { active = false; listeners.delete(setPrefs); };
  }, []);
  return prefs;
}

/** Save a change and update every component that is using the preferences. */
export async function savePrefs(change: Partial<Prefs>): Promise<boolean> {
  const res = await fetch("/api/prefs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(change),
  });
  if (!res.ok) return false;
  const next: Prefs = await res.json();
  cached = next;
  pending = Promise.resolve(next);
  listeners.forEach((notify) => notify(next));
  return true;
}

/** Reads the preferences again (after a change made through another route, such as "I am 18 or older") and updates every component using them. */
export async function reloadPrefs(): Promise<void> {
  pending = null;
  const next = await load();
  listeners.forEach((notify) => notify(next));
}
