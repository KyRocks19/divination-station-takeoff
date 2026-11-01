"use client";

import Link from "next/link";
import ReadingShell from "@/components/tools/ReadingShell";
import { CLOTH_SIZE, faceWords, placeWords } from "@/lib/charms-core";
import type { CharmCast } from "@/lib/charms";
import type { DivinationEntry } from "@/lib/divinations";
import type { Sky } from "@/lib/sky";
import { revealSpec } from "@/lib/reveal-core";

interface Props {
  initialReading: CharmCast;
  initialEntries: DivinationEntry[];
  sky: Sky & { recorded: boolean };
}

/** One saved cast: the cloth with each charm where it landed, and the same facts as a list (the picture is a decoration, the list is the reading). */
export default function CastView({ initialReading, initialEntries, sky }: Props) {
  const reading = initialReading;
  return (
    <ReadingShell
      reveal={revealSpec("charms")}
      reading={reading}
      initialEntries={initialEntries}
      sky={sky}
      api={`/api/charms/${reading.id}`}
      listHref="/charms"
      listLabel="Charm casting"
      madeWord="Cast"
      noun="cast"
      journalPrompt="What do you make of how they landed?"
      journalHint="You can come back to this later and write what happened. Reading your own words beside what followed is how your sense of a cast sharpens."
      footerLinks={[
        { href: "/charms/new", label: "Cast again" },
        { href: "/charms", label: "Past casts" },
      ]}
      toolName="Charm casting"
      shareLines={reading.charms.map((c) => `${c.charm_name}: ${faceWords(c.face)}, ${placeWords(c.x, c.y)}`)}
      deleteNote="Delete this cast and what you wrote about it? Your charms are not touched."
    >
      <section aria-label="Where the charms landed" className="space-y-4">
        <svg viewBox={`-20 -20 ${CLOTH_SIZE + 40} ${CLOTH_SIZE + 40}`} className="w-full max-w-sm mx-auto text-tone-300" aria-hidden="true" focusable="false">
          <rect x="0" y="0" width={CLOTH_SIZE} height={CLOTH_SIZE} rx="24" fill="none" stroke="currentColor" strokeWidth="6" />
          {reading.charms.map((c, i) => (
            <g key={i}>
              <circle
                cx={c.x}
                cy={c.y}
                r="34"
                fill={c.face === "up" ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="6"
                strokeDasharray={c.face === "up" ? undefined : "10 8"}
              />
              <text x={c.x} y={c.y + 14} textAnchor="middle" fontSize="40" className={c.face === "up" ? "fill-canvas" : "fill-current"}>
                {i + 1}
              </text>
            </g>
          ))}
        </svg>
        <p className="text-xs text-ink-faint leading-relaxed">A filled circle landed face up and a dashed one face down. Two charms can overlap.</p>
        <ol className="list-none p-0 space-y-2">
          {reading.charms.map((c, i) => (
            <li key={i} className="bg-surface border border-line rounded-card p-3 text-sm text-ink-soft flex flex-wrap items-baseline gap-x-2">
              <span className="text-ink-faint">{i + 1}.</span>
              <span className="font-medium text-ink-strong break-words">{c.charm_name}</span>
              <span>{faceWords(c.face)}, {placeWords(c.x, c.y)}</span>
              {c.card_id && <Link href={`/oracle/cards/${c.card_id}`} className="text-xs text-accent-ink hover:text-accent-ink-hover">Your meanings</Link>}
            </li>
          ))}
        </ol>
        <p className="text-xs text-ink-faint leading-relaxed">
          The set was “{reading.set_name}”. The names are kept as they were when you cast. The app gives no meaning to a place or a side: that is yours to write.
        </p>
      </section>
    </ReadingShell>
  );
}
