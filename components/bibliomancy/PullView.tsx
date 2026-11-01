"use client";

import Link from "next/link";
import ReadingShell from "@/components/tools/ReadingShell";
import { BIBLIOMANCY_SOURCES, UNIT_WORDS, type Unit } from "@/lib/bibliomancy-core";
import Cite from "@/components/sources/Cite";
import { parseDate, toISOString } from "@/lib/date";
import type { BibliomancyReading } from "@/lib/bibliomancy";
import type { DivinationEntry } from "@/lib/divinations";
import type { Sky } from "@/lib/sky";
import { revealSpec } from "@/lib/reveal-core";

interface Props {
  initialReading: BibliomancyReading;
  initialEntries: DivinationEntry[];
  sky: Sky & { recorded: boolean };
}

/** One saved reading: each passage pulled from the person's own writing, with the sentence around it and where it was found, and what they wrote about it. */
export default function PullView({ initialReading, initialEntries, sky }: Props) {
  const reading = initialReading;
  return (
    <ReadingShell
      reveal={revealSpec("bibliomancy")}
      reading={reading}
      initialEntries={initialEntries}
      sky={sky}
      api={`/api/bibliomancy/${reading.id}`}
      listHref="/bibliomancy"
      listLabel="Bibliomancy"
      madeWord="Pulled"
      noun="pull"
      journalPrompt="What do you make of what you found?"
      journalHint="You can come back to this later and write what happened. Reading your own words beside what followed is how your sense of your own writing sharpens."
      footerLinks={[
        { href: "/bibliomancy/new", label: "Pull again" },
        { href: "/bibliomancy", label: "Past pulls" },
      ]}
      toolName="Bibliomancy"
      shareLines={reading.pulls.map((p) => `${p.passage} (from my own writing)`)}
      deleteNote="Delete this reading and what you wrote about it? The writing the passages came from is not touched."
    >
      <section aria-label="What was pulled" className="space-y-4">
        <ol className="list-none p-0 space-y-4">
          {reading.pulls.map((p, i) => (
            <li key={i} className="bg-surface border border-line rounded-card p-4 space-y-2">
              <p className="text-[11px] text-tone-400 uppercase tracking-widest">
                {reading.pulls.length > 1 && <span className="mr-2">{i + 1}.</span>}
                {UNIT_WORDS[p.unit as Unit]?.label ?? p.unit}
              </p>
              <blockquote className="text-xl font-bold text-tone-100 leading-snug whitespace-pre-wrap break-words m-0">{p.passage}</blockquote>
              {p.context && p.context !== p.passage && (
                <p className="text-sm text-ink-muted leading-relaxed break-words">
                  <span className="text-xs text-ink-faint">The sentence around it: </span>
                  {p.context}
                </p>
              )}
              <p className="text-xs text-ink-faint break-words">
                From your writing:{" "}
                {p.source_ref && /^\/(?!\/)/.test(p.source_ref) ? (
                  <Link href={p.source_ref} className="underline hover:text-accent-ink">{p.source_label}</Link>
                ) : (
                  p.source_label
                )}
                {p.source_when && (
                  <>
                    {" · written "}
                    <time dateTime={toISOString(p.source_when)} suppressHydrationWarning>
                      {parseDate(p.source_when).toLocaleDateString()}
                    </time>
                  </>
                )}
              </p>
            </li>
          ))}
        </ol>
        <p className="text-xs text-ink-faint leading-relaxed">
          These words were kept as they were when pulled. The writing they came from may have been changed or removed since, so a link can lead somewhere different.
        </p>
        <div className="space-y-1">
          <p className="text-xs text-ink-faint leading-relaxed">{BIBLIOMANCY_SOURCES.here}</p>
          <Cite topic="bibliomancy.history" tool="bibliomancy" />
        </div>
      </section>
    </ReadingShell>
  );
}
