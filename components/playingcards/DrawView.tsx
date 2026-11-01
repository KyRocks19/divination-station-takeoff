"use client";

import Link from "next/link";
import ReadingShell from "@/components/tools/ReadingShell";
import CardFace from "@/components/playingcards/CardFace";
import { PLAYING_CARD_WORDS, getCard } from "@/lib/playingcards-data";
import type { PlayingDraw } from "@/lib/playingcards";
import type { DivinationEntry } from "@/lib/divinations";
import type { Sky } from "@/lib/sky";
import { revealSpec } from "@/lib/reveal-core";

interface Props {
  initialReading: PlayingDraw;
  initialEntries: DivinationEntry[];
  sky: Sky & { recorded: boolean };
}

/** One saved draw: each card with a link to the page where the person writes what it means to them, and what they wrote about this draw. */
export default function DrawView({ initialReading, initialEntries, sky }: Props) {
  const reading = initialReading;
  return (
    <ReadingShell
      reveal={revealSpec("playingcards")}
      reading={reading}
      initialEntries={initialEntries}
      sky={sky}
      api={`/api/playingcards/${reading.id}`}
      listHref="/playingcards"
      listLabel="Playing cards"
      madeWord="Drawn"
      noun="draw"
      journalPrompt="What do you make of these cards?"
      journalHint="You can come back to this later and write what happened. Reading your own words beside what followed is how your sense of the cards sharpens."
      footerLinks={[
        { href: "/playingcards/new", label: "Draw again" },
        { href: "/playingcards", label: "Past draws" },
        { href: "/playingcards/set", label: "The 52 cards" },
      ]}
      toolName="Playing cards"
      shareLines={reading.cards.map((c) => c.card_name)}
      deleteNote="Delete this draw and what you wrote about it?"
    >
      <section aria-label="The cards" className="space-y-4">
        <ol className="list-none p-0 flex flex-wrap gap-4">
          {reading.cards.map((c, i) => {
            const card = getCard(c.card_id);
            return (
              <li key={i} className="flex flex-col items-center gap-2 w-28 text-center">
                <CardFace cardId={c.card_id} />
                <span className="text-sm text-ink-strong">{c.card_name}</span>
                {card && <Link href={`/playingcards/set/${card.id}`} className="text-xs text-accent-ink hover:text-accent-ink-hover">Your meaning</Link>}
              </li>
            );
          })}
        </ol>
        <p className="text-xs text-ink-faint leading-relaxed">{PLAYING_CARD_WORDS.here}</p>
      </section>
    </ReadingShell>
  );
}
