"use client";

import { useEffect, useState } from "react";
import { styleRef } from "@/lib/apply-style";
import ShuffleDeck from "@/components/ShuffleDeck";
import { Button } from "@/components/ui/Button";
import { COVERED_WORDS } from "@/lib/reveal-core";

/** The least time the shuffle shows, in milliseconds (15 s more than the old 1.8 s). "I am ready" and Escape end it early. */
export const SHUFFLE_MS = 16800;

/**
 * The shuffle's wait: `done` settles after SHUFFLE_MS (at once for a person who asked for less motion), or as soon as `skip` is called.
 * The draw is made at the same time, so skipping never skips the draw.
 */
export function shuffleWait(calm: boolean): { done: Promise<void>; skip: () => void } {
  let skip = () => {};
  const done = new Promise<void>((resolve) => {
    const t = setTimeout(resolve, calm ? 0 : SHUFFLE_MS);
    skip = () => { clearTimeout(t); resolve(); };
  });
  return { done, skip };
}

interface Props {
  count: number;
  /** What the set is called: "deck" for cards, "bag" for stones. The tarot reading leaves these out. */
  group?: string;
  /** What is drawn, one and many: "card" and "cards". */
  one?: string;
  many?: string;
  /** Ends the wait early ("I am ready", or Escape). */
  onSkip?: () => void;
}

/** A pause with slowly moving card backs while a draw is made. Not shown to anyone who asked for less motion. */
export default function ShuffleOverlay({ count, group = "deck", one = "card", many = "cards", onSkip }: Props) {
  const [phase, setPhase] = useState<"shuffle" | "draw">("shuffle");
  // Cards are shuffled; stones, staves and charms are mixed.
  const verb = group === "deck" ? "Shuffling" : "Mixing";
  const drawing = `Drawing ${count} ${count !== 1 ? many : one}`;

  useEffect(() => {
    // The words change about three quarters of the way through, as they did before the wait was made longer.
    const t = setTimeout(() => setPhase("draw"), Math.round(SHUFFLE_MS * 0.72));
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!onSkip) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onSkip(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSkip]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-canvas/96 backdrop-blur-sm [animation:overlay-fade-in_0.25s_ease-out]">
      <div role="status" aria-label={phase === "shuffle" ? `${verb} the ${group}` : drawing} className="flex flex-col items-center">
        <ShuffleDeck />

        {/* Status text */}
        <div className="mt-14 text-center space-y-3">
          <p className="text-tone-200 text-xs tracking-[0.2em] uppercase transition-opacity duration-300">
            {phase === "shuffle" ? `${verb} the ${group}…` : `${drawing}…`}
          </p>
          <div className="flex justify-center gap-1.5" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1 h-1 rounded-full bg-tone-500"
                ref={styleRef({ animation: `pulse 1s ease-in-out ${-i * 0.2}s infinite` })}
              />
            ))}
          </div>
        </div>
      </div>
      {onSkip && <Button variant="text" className="mt-6 min-h-11" onClick={onSkip}>{COVERED_WORDS.skipWait}</Button>}
    </div>
  );
}
