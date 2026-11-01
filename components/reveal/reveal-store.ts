"use client";

import { useEffect, useState } from "react";

// Whether a reading's opening animation is still to come or running, shared by the reveal (components/reveal/Reveal.tsx, which decides) and the
// "write what you sense first" card (which waits for it): the person focuses on their question during the animation, then writes their first
// impression (owner's request, 2026-10-25). Keyed by the reading's shared record id.

export type Opening = "pending" | "animating" | "done";

const states = new Map<number, Opening>();
const listeners = new Map<number, Set<(o: Opening) => void>>();

export function setOpening(id: number, next: Opening) {
  states.set(id, next);
  listeners.get(id)?.forEach((fn) => fn(next));
}

/** Where the reading's opening is. "done" for no reading, so a card used without a reveal is never held back. */
export function useOpening(divinationId: number | null | undefined): Opening {
  const id = divinationId ?? null;
  const [state, setState] = useState<Opening>(id === null ? "done" : (states.get(id) ?? "pending"));
  useEffect(() => {
    if (id === null) return;
    let set = listeners.get(id);
    if (!set) listeners.set(id, (set = new Set()));
    set.add(setState);
    setState(states.get(id) ?? "pending");
    return () => { set!.delete(setState); };
  }, [id]);
  return state;
}
