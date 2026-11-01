"use client";

import { useState } from "react";
import Link from "next/link";
import ReadingShell from "@/components/tools/ReadingShell";
import FigureGlyph from "@/components/geomancy/FigureGlyph";
import FigureMeanings from "@/components/geomancy/FigureMeanings";
import { useMeaningsHeld } from "@/components/GuessGate";
import Cite from "@/components/sources/Cite";
import { buttonClass } from "@/components/ui/Button";
import { GEOMANCY_SOURCES, HOUSES, HOUSE_PLACES, METHOD_WORDS, PLACE_HOW, PLACE_WORDS, buildChart, mothersFromText, type Figure, type Place } from "@/lib/geomancy-data";
import type { GeomancyChart } from "@/lib/geomancy";
import type { DivinationEntry } from "@/lib/divinations";
import type { Sky } from "@/lib/sky";
import { revealSpec } from "@/lib/reveal-core";

function FigureCard({ place, figure, strong }: { place: Place; figure: Figure; strong?: boolean }) {
  const [open, setOpen] = useState(false);
  const held = useMeaningsHeld();
  return (
    <li className={`bg-surface border rounded-card p-3 space-y-2 ${strong ? "border-line-accent" : "border-line"}`}>
      <div className="flex items-center gap-3">
        <FigureGlyph figure={figure} decorative className="w-7 h-12 flex-shrink-0 text-tone-200" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-tone-400 uppercase tracking-widest break-words">{PLACE_WORDS[place]}</p>
          <p className="text-base font-bold text-tone-100 break-words">{figure.latin}</p>
          <p className="text-[11px] text-ink-faint break-words">{figure.english} · {PLACE_HOW[place]}</p>
        </div>
        {!held && (
          <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label={`Your words for ${figure.latin}, ${PLACE_WORDS[place]}`} className={buttonClass.text}>
            {open ? "Close" : "Your words"}
          </button>
        )}
      </div>
      {open && !held && <FigureMeanings figureId={figure.id} />}
    </li>
  );
}

function Row({ title, places, chart }: { title: string; places: Place[]; chart: Record<Place, Figure> }) {
  return (
    <section aria-label={title} className="space-y-2">
      <h2 className="text-xs text-ink-faint uppercase tracking-widest">{title}</h2>
      <ul className="list-none p-0 grid gap-2 sm:grid-cols-2">
        {places.map((p) => (
          <FigureCard key={p} place={p} figure={chart[p]} strong={p === "judge"} />
        ))}
      </ul>
    </section>
  );
}

interface Props {
  initialChart: GeomancyChart;
  initialEntries: DivinationEntry[];
  sky: Sky & { recorded: boolean };
}

/** One saved chart: the four Mothers, the Daughters, Nieces, Witnesses, Judge and Reconciler, each with the person's own words, the houses, and what they wrote. */
export default function ChartView({ initialChart, initialEntries, sky }: Props) {
  const chart = buildChart(mothersFromText(initialChart.mothers)!);
  return (
    <ReadingShell
      reveal={revealSpec("geomancy")}
      reading={initialChart}
      initialEntries={initialEntries}
      sky={sky}
      guess="meanings"
      api={`/api/geomancy/${initialChart.id}`}
      listHref="/geomancy"
      listLabel="Geomancy"
      madeWord="Cast"
      noun="chart"
      journalPrompt="What do you make of this chart?"
      journalHint="You can come back to this chart later and write what happened. Reading your own words next to what followed is how your sense of the figures sharpens."
      footerLinks={[
        { href: "/geomancy/new", label: "Cast again" },
        { href: "/geomancy", label: "Past charts" },
        { href: "/geomancy/set", label: "The 16 figures" },
      ]}
      toolName="Geomancy"
      shareLines={(Object.keys(PLACE_WORDS) as Place[]).map((p) => `${PLACE_WORDS[p]}: ${chart[p].latin}`)}
      deleteNote="Delete this chart and what you wrote about it? Your own meanings for the figures are not touched."
    >
      <section aria-label="The chart" className="space-y-5">
        <p className="text-sm text-ink-muted">{METHOD_WORDS[initialChart.method]}.</p>
        <Row title="The answer" places={["judge", "rightWitness", "leftWitness"]} chart={chart} />
        <Row title="The Mothers (the cast)" places={["mother1", "mother2", "mother3", "mother4"]} chart={chart} />
        <Row title="The Daughters" places={["daughter1", "daughter2", "daughter3", "daughter4"]} chart={chart} />
        <Row title="The Nieces" places={["niece1", "niece2", "niece3", "niece4"]} chart={chart} />
        <Row title="The Reconciler" places={["reconciler"]} chart={chart} />
        <div className="space-y-1">
          <p className="text-xs text-ink-faint leading-relaxed">{GEOMANCY_SOURCES.chart}</p>
          <Cite topic="geomancy.chart" tool="geomancy" />
        </div>

        <details>
          <summary className="cursor-pointer min-h-11 sm:min-h-0 flex items-center text-sm text-ink-muted">The twelve houses</summary>
          <p className="text-xs text-ink-faint leading-relaxed mt-2">{GEOMANCY_SOURCES.houses}</p>
          <Cite topic="geomancy.houses" tool="geomancy" />
          <ol className="list-none p-0 mt-2 space-y-1">
            {HOUSES.map((h, i) => (
              <li key={h.n} className="text-sm text-ink-soft">
                House {h.n}, {h.latin} ({h.english}): <span className="text-ink-strong">{chart[HOUSE_PLACES[i]].latin}</span>{" "}
                <span className="text-xs text-ink-faint">({PLACE_WORDS[HOUSE_PLACES[i]]})</span>
              </li>
            ))}
          </ol>
        </details>
        <p className="text-xs text-ink-faint">
          <Link href="/geomancy/set" className="underline hover:text-accent-ink">All sixteen figures and your words for them</Link>
        </p>
      </section>
    </ReadingShell>
  );
}
