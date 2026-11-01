"use client";

import ReadingShell from "@/components/tools/ReadingShell";
import BlotPicture from "@/components/blots/BlotPicture";
import { revealSpec } from "@/lib/reveal-core";
import { DIVINATION_KIND_LABELS } from "@/lib/divination-kinds";
import { BLOT_WORDS, blotSummary } from "@/lib/blots-core";
import type { BlotCast } from "@/lib/blots";
import type { DivinationEntry } from "@/lib/divinations";
import type { Sky } from "@/lib/sky";

interface Props {
  initialReading: BlotCast;
  initialEntries: DivinationEntry[];
  sky: Sky & { recorded: boolean };
}

/** One saved ink blot, drawn again from its seed, with a place to write what the person sees in it. */
export default function BlotView({ initialReading, initialEntries, sky }: Props) {
  const reading = initialReading;
  return (
    <ReadingShell
      reveal={revealSpec("blots")}
      reading={reading}
      initialEntries={initialEntries}
      sky={sky}
      api={`/api/blots/${reading.id}`}
      listHref="/blots"
      listLabel={DIVINATION_KIND_LABELS.blots}
      madeWord="Pressed"
      noun="blot"
      journalPrompt="What do you see in it?"
      journalHint="Look for a while, then write whatever you see: a face, an animal, a place, a letter, a feeling. Come back later and write what followed. Reading your own words beside it is how your sense of what you notice sharpens."
      footerLinks={[
        { href: "/blots/new", label: "Press another" },
        { href: "/blots", label: "Past blots" },
      ]}
      toolName={DIVINATION_KIND_LABELS.blots}
      shareLines={[blotSummary("ink")]}
      deleteNote="Delete this blot and what you wrote about it?"
    >
      <section aria-label="The blot" className="space-y-3">
        <BlotPicture seed={reading.seed} label={`${blotSummary("ink")}. The picture has no meaning given; write what you see in it.`} />
        <p className="text-xs text-ink-faint leading-relaxed">{BLOT_WORDS.noMeaning}</p>
      </section>
    </ReadingShell>
  );
}
