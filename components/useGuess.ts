"use client";

import { useCallback, useEffect, useState } from "react";
import { meaningsHeldBack, type Confidence, type Fit, type Guess, type GuessState } from "@/lib/guess-core";

// What the browser knows about the "write what you sense first" step on a reading. One copy per reading, shared by the card that asks and by every
// part of the page that opens a meaning, so sealing a guess opens them all at once.

const states = new Map<number, GuessState>();
const listeners = new Map<number, Set<(s: GuessState) => void>>();
const pending = new Map<number, Promise<void>>();

const UNKNOWN: GuessState = { loaded: false, stepOn: false, guess: null };

function publish(id: number, next: GuessState) {
  states.set(id, next);
  listeners.get(id)?.forEach((fn) => fn(next));
}

function load(id: number): Promise<void> {
  let p = pending.get(id);
  if (!p) {
    p = fetch(`/api/divinations/${id}/guess`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((data: { step_on?: boolean; guess?: Guess | null } | null) => {
        // A failed read must not lock the meanings forever: the step is then treated as off.
        publish(id, { loaded: true, stepOn: !!data?.step_on, guess: data?.guess ?? null });
      });
    pending.set(id, p);
  }
  return p;
}

async function send(id: number, method: string, body?: unknown): Promise<Guess | null> {
  const res = await fetch(`/api/divinations/${id}/guess`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "failed");
  return method === "DELETE" ? null : ((await res.json()).guess as Guess);
}

export interface GuessApi {
  state: GuessState;
  /** True while the reading's meanings should stay closed. */
  held: boolean;
  seal: (text: string, confidence?: Confidence | null, logic?: string) => Promise<void>;
  /** Whether the companion may read this guess (off unless the person ticks it). */
  shareWithCompanion: (ok: boolean) => Promise<void>;
  skip: () => Promise<void>;
  rate: (fit: Fit | null, note: string) => Promise<void>;
  forget: () => Promise<void>;
}

/** The step on one reading, by its shared record id (`divinations.id`). Meanings stay closed (`held`) until the person writes or skips; throws from the actions carry a message to show. */
export function useGuess(divinationId: number | null | undefined): GuessApi {
  const id = divinationId ?? null;
  const [state, setState] = useState<GuessState>(id !== null ? (states.get(id) ?? UNKNOWN) : { loaded: true, stepOn: false, guess: null });

  useEffect(() => {
    if (id === null) return;
    let set = listeners.get(id);
    if (!set) listeners.set(id, (set = new Set()));
    set.add(setState);
    if (states.has(id)) setState(states.get(id)!);
    else void load(id);
    return () => { set!.delete(setState); };
  }, [id]);

  const guess = (g: Guess | null) => id !== null && publish(id, { loaded: true, stepOn: states.get(id)?.stepOn ?? true, guess: g });
  const seal = useCallback(async (text: string, confidence: Confidence | null = null, logic = "") => { guess(await send(id!, "PUT", { guess: text, confidence, logic: logic.trim() || null })); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const shareWithCompanion = useCallback(async (ok: boolean) => { guess(await send(id!, "PATCH", { companion_ok: ok })); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const skip = useCallback(async () => { guess(await send(id!, "PUT", { skip: true })); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const rate = useCallback(async (fit: Fit | null, note: string) => { guess(await send(id!, "PATCH", { fit, note })); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const forget = useCallback(async () => { await send(id!, "DELETE"); guess(null); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  return { state, held: id !== null && meaningsHeldBack(state), seal, shareWithCompanion, skip, rate, forget };
}
