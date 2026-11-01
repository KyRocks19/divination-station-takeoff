"use client";

import ShuffleDeck from "@/components/ShuffleDeck";
import { COVERED_WORDS } from "@/lib/reveal-core";

interface Props {
  count: number;
  /** What the set is called: "deck" for cards, "bag" for stones. The tarot reading leaves these out. */
  group?: string;
  /** What is drawn, one and many: "card" and "cards". */
  one?: string;
  many?: string;
  /** The question or intention, shown as the reading's opening will show it. */
  question?: string | null;
}

/**
 * The shuffling deck while a draw is made and saved. It has no wait of its own any more: holding the question and shuffling are one
 * step (owner's request, 2026-11-01), and that step is the reading's opening (components/reveal/Reveal.tsx), whose length the person
 * chooses in Settings. This only covers the moment between pressing the button and the reading page taking over, and it looks like the
 * start of that opening so the two read as one. Not shown to anyone who asked for less motion.
 */
export default function ShuffleOverlay({ count, group = "deck", one = "card", many = "cards", question = null }: Props) {
  // Cards are shuffled; stones, staves and charms are mixed.
  const verb = group === "deck" ? "Shuffling" : "Mixing";
  const words = `${verb} the ${group} and drawing ${count} ${count !== 1 ? many : one}…`;
  const q = question?.trim() || null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-canvas/95 backdrop-blur-sm px-4 pb-40 [animation:overlay-fade-in_0.25s_ease-out]">
      <div className="text-center space-y-2 max-w-xl">
        <p className="text-xs uppercase tracking-widest text-ink-faint">{q ? COVERED_WORDS.holdQuestion : COVERED_WORDS.holdNoQuestion}</p>
        {q && <p className="text-lg text-ink-strong leading-relaxed whitespace-pre-wrap break-words">{q}</p>}
      </div>
      <ShuffleDeck className="w-[min(55vw,15rem)] min-h-[260px]" />
      <div role="status" className="fixed inset-x-0 bottom-0 pb-[max(2.5rem,env(safe-area-inset-bottom))] px-6 text-center">
        <p className="text-base text-ink-soft leading-relaxed max-w-xl mx-auto">{words}</p>
      </div>
    </div>
  );
}
