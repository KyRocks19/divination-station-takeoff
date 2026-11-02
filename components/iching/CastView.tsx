"use client";

import { useState } from "react";
import Link from "next/link";
import ReadingShell from "@/components/tools/ReadingShell";
import HexagramGlyph from "@/components/iching/HexagramGlyph";
import HexagramMeanings from "@/components/iching/HexagramMeanings";
import { useMeaningsHeld } from "@/components/GuessGate";
import { buttonClass } from "@/components/ui/Button";
import { LINE_WORDS, METHOD_WORDS, changingWords, getHexagram, resultOf, trigramWords, type Hexagram, type LineValue } from "@/lib/iching-data";
import type { IChingCast } from "@/lib/iching";
import type { DivinationEntry } from "@/lib/divinations";
import type { Sky } from "@/lib/sky";
import Hanzi from "@/components/ui/Hanzi";
import { revealSpec } from "@/lib/reveal-core";

function HexagramCard({ h, label, values, which }: { h: Hexagram; label: string; values?: LineValue[]; which: string }) {
  const [open, setOpen] = useState(false);
  const held = useMeaningsHeld();
  return (
    <section aria-label={label} className="bg-surface border border-line rounded-card p-4 space-y-3">
      <div className="flex items-center gap-4">
        <HexagramGlyph
          lines={h.lines}
          values={values}
          label={`${label}: hexagram ${h.n}, ${h.pinyin}. ${values ? "Lines from the bottom: " + values.map((v, i) => `${i + 1} ${LINE_WORDS[v]}`).join("; ") : ""}`}
          className="w-16 h-16 flex-shrink-0 text-tone-200"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-tone-400 uppercase tracking-widest">{which}</p>
          <p className="text-xl font-bold text-tone-100 break-words">
            <span className="text-sm text-ink-ghost font-normal mr-2">{h.n}.</span>
            <Hanzi>{h.char}</Hanzi> {h.pinyin}
          </p>
          <p className="text-xs text-ink-faint">{h.english} · {trigramWords(h)}</p>
        </div>
        {!held && (
          <button onClick={() => setOpen(!open)} aria-expanded={open} className={buttonClass.text}>
            {open ? "Close" : "Your words"}
          </button>
        )}
      </div>
      {open && !held && <HexagramMeanings hexagram={h.n} />}
    </section>
  );
}

interface Props {
  initialCast: IChingCast;
  initialEntries: DivinationEntry[];
  sky: Sky & { recorded: boolean };
}

/** One saved cast: the six lines, the hexagram they made and the one they turn into, each with the person's own words, and what they wrote. */
export default function CastView({ initialCast, initialEntries, sky }: Props) {
  const cast = initialCast;
  const result = resultOf(cast.lines);
  return (
    <ReadingShell
      reveal={revealSpec("iching")}
      reading={cast}
      initialEntries={initialEntries}
      sky={sky}
      guess="meanings"
      ownDraw={cast.method === "entered"}
      api={`/api/iching/${cast.id}`}
      listHref="/iching"
      listLabel="I Ching"
      madeWord="Cast"
      noun="cast"
      journalPrompt="What do you make of this cast?"
      journalHint="You can come back to this cast later and write what happened. Reading your own words next to what followed is how your sense of the hexagrams sharpens."
      footerLinks={[
        { href: "/iching/new", label: "Cast again" },
        { href: "/iching", label: "Past casts" },
        { href: "/iching/set", label: "The 64 hexagrams" },
      ]}
      toolName="I Ching"
      shareLines={[
        `Lines from the bottom: ${cast.lines.join(", ")} (${changingWords(result.changing).toLowerCase()})`,
        `First hexagram: ${result.primary.n} ${result.primary.pinyin} (${result.primary.english})`,
        ...(result.relating ? [`Second hexagram: ${result.relating.n} ${result.relating.pinyin} (${result.relating.english})`] : []),
      ]}
      deleteNote="Delete this cast and what you wrote about it? Your own meanings for the hexagrams are not touched."
    >
      <section aria-label="The cast" className="space-y-4">
        <p className="text-sm text-ink-muted">
          {METHOD_WORDS[cast.method]}. {changingWords(result.changing)}.
        </p>
        <HexagramCard h={result.primary} label="First hexagram" values={cast.lines} which="The cast" />
        {result.relating ? (
          <HexagramCard h={result.relating} label="Second hexagram" which="What the changing lines turn it into" />
        ) : (
          <p className="text-sm text-ink-faint">No line is changing, so there is no second hexagram.</p>
        )}
        <details className="text-sm text-ink-muted">
          <summary className="cursor-pointer min-h-11 sm:min-h-0 flex items-center">The six lines</summary>
          <ol className="list-none p-0 mt-2 space-y-1">
            {[...cast.lines].map((v, i) => ({ v, n: i + 1 })).reverse().map(({ v, n }) => (
              <li key={n} className="text-sm">
                Line {n}{n === 1 ? " (bottom)" : n === 6 ? " (top)" : ""}: {v}, {LINE_WORDS[v]}
              </li>
            ))}
          </ol>
        </details>
        <p className="text-xs text-ink-faint">
          Hexagrams {result.primary.n}
          {result.relating ? ` and ${result.relating.n}` : ""}: <Link href={`/iching/set/${result.primary.n}`} className="underline hover:text-accent-ink">open {getHexagram(result.primary.n)?.pinyin} in the set</Link>
        </p>
      </section>
    </ReadingShell>
  );
}
