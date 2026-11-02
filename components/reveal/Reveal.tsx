"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useGuess } from "@/components/useGuess";
import RevealScene from "@/components/reveal/RevealScene";
import { setOpening } from "@/components/reveal/reveal-store";
import { useRevealWait } from "@/components/reveal/useRevealWait";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { styleRef } from "@/lib/apply-style";
import { COVERED_WORDS, REVEALED_KEY, parseRevealed, revealLine, shouldAnimate, type RevealSpec } from "@/lib/reveal-core";
import type { TeaKind } from "@/lib/tea-core";

interface Props {
  /** The reading's shared record (`divinations.id`); null when it has none, or for a tool whose "sense first" step is off. */
  divinationId: number | null | undefined;
  /** A key for this reading in the tab's list of readings already shown, such as "d12" or "t5". */
  readingKey: string;
  /** When the reading was made, to tell a new reading from an older one. */
  createdAt: string | null;
  spec: RevealSpec;
  /** The tea chosen for a tea-leaf reading: the brewing cup takes its colour. */
  tea?: TeaKind | null;
  /** The question or intention, shown during the animation so the person can hold it in mind. */
  question?: string | null;
  /** A few words to bring to mind while it opens, such as a tea's concepts. */
  focus?: string[];
  /** The person drew this with their own deck, coins or stones and recorded it here: they have seen the result, so it opens at once,
   *  with no animation, no wait and nothing covered (lib/own-draw.ts). */
  ownDraw?: boolean;
  children: React.ReactNode;
}

type Phase = "waiting" | "covered" | "opening" | "shown";

let methodPromise: Promise<string | null> | null = null;
/** The randomness method chosen in Settings, read once per page load. */
function loadMethod(): Promise<string | null> {
  methodPromise ??= fetch("/api/rng-method")
    .then((r) => (r.ok ? r.json() : null))
    .then((d: { method?: string } | null) => (typeof d?.method === "string" ? d.method : null))
    .catch(() => null);
  return methodPromise;
}

function seenBefore(key: string): boolean {
  try {
    return parseRevealed(sessionStorage.getItem(REVEALED_KEY)).includes(key);
  } catch {
    return false;
  }
}

function markSeen(key: string) {
  try {
    const list = parseRevealed(sessionStorage.getItem(REVEALED_KEY)).filter((k) => k !== key);
    sessionStorage.setItem(REVEALED_KEY, [...list, key].join(","));
  } catch {
    // Without storage the reveal may play again on this tab; nothing else changes.
  }
}

/**
 * The opening of a reading (owner's requests, 2026-10-25). A new reading first plays a short animation and wait, with the question shown
 * so the person can hold it in mind, and a line near the bottom of the screen saying what is happening and which randomness method made
 * the reading. Then the "write what you sense first" card appears (it waits for the animation, components/reveal/reveal-store.ts), and the
 * result stays covered until the person has sealed their first impression or skipped that step. An older reading opened again skips the
 * animation. "I am ready" and Escape end the wait early.
 */
export default function Reveal({ divinationId, readingKey, createdAt, spec, tea = null, question = null, focus = [], ownDraw = false, children }: Props) {
  const { state, held } = useGuess(divinationId);
  // The one wait's length is the person's choice in Settings (30 seconds to five minutes), read before the opening starts.
  const [waitSeconds] = useRevealWait();
  const ms = waitSeconds === null ? spec.ms : waitSeconds * 1000;
  const ready = (divinationId === null || divinationId === undefined || state.loaded) && waitSeconds !== null;
  const [phase, setPhase] = useState<Phase>("waiting");
  const [method, setMethod] = useState<string | null>(null);

  // Decide once the "sense first" step is known: open with the animation, or go straight to covered or shown.
  useEffect(() => {
    if (!ready) return;
    setPhase((p) => {
      if (p !== "waiting") return p;
      if (ownDraw) return "shown";
      if (shouldAnimate({ held, createdAt, now: Date.now(), seen: seenBefore(readingKey) })) return "opening";
      return held ? "covered" : "shown";
    });
  }, [ready, held, createdAt, readingKey, ownDraw]);

  // A covered reading opens as soon as the first impression is sealed or the step is skipped.
  useEffect(() => {
    if (phase === "covered" && !held) setPhase("shown");
  }, [phase, held]);

  // While opening: read the method for the line, wait, then move on to the first impression (or straight to the reading when the step is off).
  useEffect(() => {
    if (phase !== "opening") return;
    let live = true;
    if (spec.random) void loadMethod().then((m) => live && setMethod(m));
    const finish = () => setPhase("covered");
    const done = setTimeout(finish, ms);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") finish(); };
    window.addEventListener("keydown", onKey);
    return () => { live = false; clearTimeout(done); window.removeEventListener("keydown", onKey); };
  }, [phase, spec, ms]);

  // The first-impression card follows the opening.
  useEffect(() => {
    if (divinationId === null || divinationId === undefined) return;
    setOpening(divinationId, phase === "waiting" ? "pending" : phase === "opening" ? "animating" : "done");
  }, [phase, divinationId]);

  useEffect(() => {
    if (phase !== "waiting" && phase !== "opening") markSeen(readingKey);
  }, [phase, readingKey]);

  if (phase === "shown") return <>{children}</>;

  if (phase === "covered") {
    if (!held) return <>{children}</>;
    return (
      <section aria-label="Your reading, covered">
        <Card className="flex items-center gap-4">
          <RevealScene scene={spec.scene} tea={tea} still className="h-20 w-20 shrink-0 opacity-70" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-ink-strong">{COVERED_WORDS.title}</p>
            <p className="text-sm text-ink-muted leading-relaxed">{COVERED_WORDS.body}</p>
          </div>
        </Card>
      </section>
    );
  }

  if (phase === "waiting") {
    // Nothing of the reading reaches the page until the step is known.
    return <div className="min-h-24" aria-hidden="true" />;
  }

  return (
    <>
      <div className="min-h-24" aria-hidden="true" />
      {createPortal(
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-canvas/95 backdrop-blur-sm px-4 pb-40 [animation:overlay-fade-in_0.25s_ease-out]">
          <div className="text-center space-y-2 max-w-xl">
            <p className="text-xs uppercase tracking-widest text-ink-faint">{question ? COVERED_WORDS.holdQuestion : COVERED_WORDS.holdNoQuestion}</p>
            {question && <p className="text-lg text-ink-strong leading-relaxed whitespace-pre-wrap break-words">{question}</p>}
            {focus.length > 0 && <p className="text-sm text-ink-muted">{focus.join(" · ")}</p>}
          </div>
          <RevealScene scene={spec.scene} tea={tea} className="w-[min(55vw,15rem)] h-auto" />
          <div role="status" className="fixed inset-x-0 bottom-0 pb-[max(2.5rem,env(safe-area-inset-bottom))] px-6 text-center space-y-3">
            <p className="text-base text-ink-soft leading-relaxed max-w-xl mx-auto">{revealLine(spec, spec.random ? method : null)}</p>
            <div className="mx-auto h-1 w-48 max-w-full overflow-hidden rounded-full bg-tone-700/30" aria-hidden="true">
              <div className="rv-wait h-full w-full bg-tone-400" ref={styleRef({ animationDuration: `${ms}ms` })} />
            </div>
            <Button variant="text" className="min-h-11" onClick={() => setPhase("covered")}>{COVERED_WORDS.skipWait}</Button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
