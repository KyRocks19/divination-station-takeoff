"use client";

import ReadingShell from "@/components/tools/ReadingShell";
import TeaCupPicture from "@/components/tea/TeaCupPicture";
import TeaConcepts from "@/components/tea/TeaConcepts";
import { revealSpec } from "@/lib/reveal-core";
import { getTea } from "@/lib/tea-core";
import { getArchetype } from "@/lib/archetypes-data";
import { DIVINATION_KIND_LABELS } from "@/lib/divination-kinds";
import { TEA_READING_WORDS, blotSummary } from "@/lib/blots-core";
import type { BlotCast } from "@/lib/blots";
import type { DivinationEntry } from "@/lib/divinations";
import type { Sky } from "@/lib/sky";

interface Props {
  initialReading: BlotCast;
  initialEntries: DivinationEntry[];
  sky: Sky & { recorded: boolean };
}

/** One saved cup of tea leaves, drawn again from its seed and tea, with a place to write what the person sees in it. */
export default function TeaView({ initialReading, initialEntries, sky }: Props) {
  const reading = initialReading;
  const summary = blotSummary("cup", reading.tea);
  return (
    <ReadingShell
      reveal={revealSpec("tea")}
      tea={reading.tea}
      focus={reading.tea ? getTea(reading.tea).concepts.map((slug) => getArchetype(slug)?.name).filter((n): n is string => !!n) : []}
      reading={reading}
      initialEntries={initialEntries}
      sky={sky}
      api={`/api/tea/${reading.id}`}
      listHref="/tea"
      listLabel={DIVINATION_KIND_LABELS.tea}
      madeWord="Poured"
      noun="cup"
      journalPrompt="What do you see in the leaves?"
      journalHint="Look for a while, then write whatever you see: a face, an animal, a place, a letter, a feeling. Come back later and write what followed. Reading your own words beside it is how your sense of what you notice sharpens."
      footerLinks={[
        { href: "/tea/new", label: "Brew another" },
        { href: "/tea", label: "Past cups" },
      ]}
      toolName={DIVINATION_KIND_LABELS.tea}
      shareLines={[summary]}
      deleteNote="Delete this cup and what you wrote about it?"
    >
      <section aria-label="The cup" className="space-y-3">
        <TeaCupPicture seed={reading.seed} tea={reading.tea} label={`${summary}. The picture has no meaning given; write what you see in it.`} />
        <p className="text-xs text-ink-faint leading-relaxed">{TEA_READING_WORDS.noMeaning}</p>
        {reading.tea && <TeaConcepts tea={reading.tea} />}
      </section>
    </ReadingShell>
  );
}
