"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CompanionMode } from "@/lib/companion-modes";
import type { JobView, NoteView } from "@/lib/companion-queue-types";

export interface Immediate {
  action: "crisis" | "checkin";
  text: string;
  canContinue: boolean;
  /** Which kind of request this pause answered, so "carry on" asks the same thing again. */
  mode: CompanionMode;
  /** For a pause about a pattern: which one. */
  pattern?: string;
}

export interface Caps {
  supported: boolean;
  changes: boolean;
}

interface Listing {
  jobs: JobView[];
  notes: NoteView[];
  mode: "direct" | "queue";
  studio: { awake: boolean } | null;
}

export type Subject =
  | { divinationId: number; cardId?: undefined; self?: undefined; patterns?: undefined }
  | { cardId: number; divinationId?: undefined; self?: undefined; patterns?: undefined }
  | { self: true; divinationId?: undefined; cardId?: undefined; patterns?: undefined }
  // Every question the person has asked about a pattern (the Patterns page).
  | { patterns: true; divinationId?: undefined; cardId?: undefined; self?: undefined };

function send(url: string, method: string, body?: unknown) {
  return fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const param = (s: Subject) => (s.patterns ? "patterns=1" : s.self ? "self=1" : s.cardId !== undefined ? `card_id=${s.cardId}` : `divination_id=${s.divinationId}`);

/**
 * Everything the companion's two places on a page (the panel on a reading, the picture ideas on an item) share: what has been asked and
 * answered, the answers the person kept, a fixed reply that came straight back, and the buttons' actions. Polls while a request waits.
 */
export function useCompanionJobs(subject: Subject, enabled: boolean, wantCaps = false) {
  const [listing, setListing] = useState<Listing>({ jobs: [], notes: [], mode: "queue", studio: null });
  const [caps, setCaps] = useState<Caps | null>(null);
  const [immediate, setImmediate] = useState<Immediate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const key = param(subject);

  const load = useCallback(
    async (first = false) => {
      try {
        const res = await fetch(`/api/companion/jobs?${key}${first && wantCaps ? "&caps=1" : ""}`);
        if (!res.ok) return;
        const data = await res.json();
        setListing({ jobs: data.jobs, notes: data.notes, mode: data.mode, studio: data.studio });
        if (data.caps) setCaps(data.caps);
      } catch {
        /* the next poll tries again */
      }
    },
    [key, wantCaps]
  );

  const waiting = listing.jobs.some((j) => j.status === "queued" || j.status === "running");

  useEffect(() => {
    if (enabled) void load(true);
  }, [enabled, load]);

  useEffect(() => {
    if (!waiting) return;
    timer.current = setInterval(() => void load(), 3000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [waiting, load]);

  const run = useCallback(
    async (request: () => Promise<Response>, failure: string) => {
      setBusy(true);
      setError(null);
      try {
        const res = await request();
        if (!res.ok) throw new Error();
        await load();
      } catch {
        setError(failure);
      } finally {
        setBusy(false);
      }
    },
    [load]
  );

  /** Asks the companion. A fixed reply (crisis, or a gentle pause) comes straight back and nothing is queued. */
  const ask = useCallback(
    async (mode: CompanionMode, acknowledged = false, pattern?: string) => {
      setBusy(true);
      setError(null);
      setImmediate(null);
      try {
        const res = await send("/api/companion/ask", "POST", { ...(pattern !== undefined ? { pattern } : subject.self ? { self: true } : subject.cardId !== undefined ? { card_id: subject.cardId } : { divination_id: subject.divinationId }), mode, acknowledged });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "That could not be asked. Try again.");
        if (body.immediate) setImmediate({ ...body.immediate, mode, pattern });
        else await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "That could not be asked. Try again.");
      } finally {
        setBusy(false);
      }
    },
    [subject.cardId, subject.divinationId, subject.self, load]
  );

  const remove = (id: number, failure = "That could not be cleared. Try again.") => run(() => send(`/api/companion/jobs/${id}`, "DELETE"), failure);
  const keep = (id: number) => run(() => send(`/api/companion/jobs/${id}/keep`, "POST"), "That could not be kept. Try again.");
  const deleteNote = (id: number) => run(() => send(`/api/companion/notes/${id}`, "DELETE"), "That could not be deleted. Try again.");

  return { listing, caps, immediate, setImmediate, busy, error, setError, waiting, ask, remove, keep, deleteNote, load };
}
