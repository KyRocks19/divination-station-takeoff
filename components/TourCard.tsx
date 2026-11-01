"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SectionLabel } from "@/components/ui/Page";
import { TOUR_STEPS } from "@/lib/tour-steps";

/**
 * The first-run tour on the home page: five short steps, each skippable. Finishing or skipping remembers it, so it does not come back by itself;
 * the same words are on the How this works page, which can show it again.
 */
export default function TourCard({ replay = false }: { replay?: boolean }) {
  const [step, setStep] = useState(0);
  const [gone, setGone] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  if (gone) return null;

  const last = step === TOUR_STEPS.length - 1;
  const s = TOUR_STEPS[step];

  async function close() {
    setGone(true);
    // A replay changes nothing: the first time it was seen is already kept.
    if (!replay) await fetch("/api/tour/seen", { method: "POST" }).catch(() => null);
  }

  function go(to: number) {
    setStep(to);
    // Keep a keyboard or screen reader person at the step's title (the title element stays; only its words change).
    heading.current?.focus();
  }

  return (
    <Card role="region" aria-labelledby="tour-title" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <SectionLabel>{replay ? "The tour again" : "A short tour"}: step {step + 1} of {TOUR_STEPS.length}</SectionLabel>
        <button onClick={close} className="text-xs text-ink-ghost hover:text-ink-soft underline">
          {replay ? "Close" : "Skip the tour"}
        </button>
      </div>
      <h2 id="tour-title" ref={heading} tabIndex={-1} className="font-semibold text-ink-strong focus:outline-none">{s.title}</h2>
      <p className="text-sm text-ink-soft leading-relaxed" aria-live="polite">{s.body}</p>
      {s.link && (
        <p className="text-sm">
          <Link href={s.link.href} className="text-tone-400 underline">{s.link.label}</Link>
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        {step > 0 && <Button variant="quiet" onClick={() => go(step - 1)}>Back</Button>}
        {last ? <Button onClick={close}>Done</Button> : <Button onClick={() => go(step + 1)}>Next</Button>}
      </div>
    </Card>
  );
}
