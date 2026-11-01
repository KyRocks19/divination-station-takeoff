"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import FillImage from "@/components/ui/FillImage";
import { buttonClass } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Field";
import { cardIdToFileName } from "@/lib/card-image";

/**
 * A guided first reading for a newcomer: one card and three short questions (see, feel, say), in plain words. Nothing
 * is saved until the last button. The card is drawn upright; reversed cards and spreads come later, on the usual page.
 * What the person writes is saved as their own words: what they saw as a first impression of the card, the other two
 * as notes, in the order they wrote them. The app adds no meaning of its own.
 */

interface DrawnCard {
  id: string;
  name: string;
}

const STEPS = [
  {
    title: "What do you see?",
    label: "What I see",
    help: "Look at the picture. Write what stands out to you: a colour, a person, an object, a mood. Describe it. You do not need to explain it yet.",
    kind: "impression" as const,
  },
  {
    title: "What do you feel?",
    label: "What I feel",
    help: "Notice how this card sits with you, in your body or as a mood. One word is enough.",
    kind: "note" as const,
  },
  {
    title: "What would you say about it?",
    label: "What I would say",
    help: "In your own words, what do you make of this card right now? A guess is fine. You decide what it means.",
    kind: "note" as const,
  },
];

export default function FirstReading() {
  const router = useRouter();
  const uid = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const [question, setQuestion] = useState("");
  const [card, setCard] = useState<DrawnCard | null>(null);
  const [step, setStep] = useState(0);
  const [texts, setTexts] = useState(["", "", ""]);
  const [drawing, setDrawing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when the reading was saved but some of the writing was not.
  const [savedId, setSavedId] = useState<number | null>(null);

  // Moving to the next question moves the cursor to its heading, so a screen reader or keyboard follows.
  const moved = useRef(false);
  useEffect(() => {
    if (moved.current) heading.current?.focus();
    moved.current = true;
  }, [step, card]);

  async function draw() {
    if (drawing) return;
    setDrawing(true);
    setError(null);
    try {
      const res = await fetch("/api/draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 1 }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCard({ id: data.cards[0].id, name: data.cards[0].name });
      setStep(0);
    } catch {
      setError("Could not draw a card. Nothing was saved; press the button again.");
    } finally {
      setDrawing(false);
    }
  }

  async function save() {
    if (!card || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spread_name: "One card",
          title: null,
          question: question.trim() || null,
          cards: [{ position: "Your card", card_id: card.id, card_name: card.name, reversed: false }],
          notes: null,
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      if (!res.ok) throw new Error();
      const reading = await res.json();

      // The writing goes in one entry at a time, in the order it was written, so the first impression is the oldest.
      let failed = 0;
      for (let i = 0; i < STEPS.length; i++) {
        const content = texts[i].trim();
        if (!content) continue;
        try {
          const r = await fetch("/api/journals", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              reading_id: reading.id,
              author: "user",
              content,
              kind: STEPS[i].kind,
              card_index: 0,
            }),
          });
          if (!r.ok) failed++;
        } catch {
          failed++;
        }
      }
      if (failed > 0) {
        setSavedId(reading.id);
        setSaving(false);
        return;
      }
      router.push(`/readings/${reading.id}`);
    } catch {
      setError("Could not save your reading. Your writing is still here; press the button again.");
      setSaving(false);
    }
  }

  if (savedId !== null) {
    return (
      <div className="space-y-3" role="status">
        <p className="text-sm text-ink-strong">
          Your reading was saved, but some of what you wrote could not be. Open the reading to add it again.
        </p>
        <Link href={`/readings/${savedId}`} className={buttonClass.text}>Open my reading</Link>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="bg-surface border border-line rounded-card p-5 space-y-4">
        <p className="text-sm text-ink-soft leading-relaxed">
          This takes about five minutes. You will draw one card and write three short things about it. There are no
          wrong answers and nothing is scored. You can leave any box empty.
        </p>
        <Field
          htmlFor={`${uid}-question`}
          label="Is there something on your mind? (optional)"
          hint="A question, a worry, or nothing at all. It is saved with your reading."
        >
          <Textarea id={`${uid}-question`} value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} />
        </Field>
        <button onClick={draw} disabled={drawing} className={buttonClass.primary}>
          {drawing ? "Drawing…" : "Draw a card"}
        </button>
        {error && <p className="text-xs text-danger" role="alert">{error}</p>}
      </div>
    );
  }

  const current = STEPS[step];
  const last = step === STEPS.length - 1;
  const fileName = cardIdToFileName(card.id);

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-2">
        <div className="relative w-40 h-[280px] rounded-lg overflow-hidden border-2 border-line-accent shadow-lg shadow-tone-900/30">
          <FillImage src={`/cards/${fileName}`} alt={card.name} className="object-cover" sizes="160px" />
        </div>
        <p className="text-sm font-medium text-ink-strong">{card.name}</p>
      </div>

      <section aria-labelledby={`${uid}-step`} className="bg-surface border border-line rounded-card p-5 space-y-4">
        <p className="text-xs text-ink-faint">Question {step + 1} of {STEPS.length}</p>
        <h2 id={`${uid}-step`} ref={heading} tabIndex={-1} className="text-xl font-bold text-tone-100 focus:outline-none">
          {current.title}
        </h2>
        <Field htmlFor={`${uid}-text`} label={current.label} hint={current.help}>
          <Textarea
            id={`${uid}-text`}
            key={step}
            value={texts[step]}
            onChange={(e) => setTexts((t) => t.map((x, i) => (i === step ? e.target.value : x)))}
            rows={4}
          />
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          {step > 0 && (
            <button type="button" onClick={() => setStep(step - 1)} disabled={saving} className={buttonClass.quiet}>
              Back
            </button>
          )}
          {last ? (
            <button type="button" onClick={save} disabled={saving} className={buttonClass.primary}>
              {saving ? "Saving…" : "Save my reading"}
            </button>
          ) : (
            <button type="button" onClick={() => setStep(step + 1)} className={buttonClass.primary}>
              Next
            </button>
          )}
        </div>
        {error && <p className="text-xs text-danger" role="alert">{error}</p>}
      </section>

      <p className="text-xs text-ink-faint leading-relaxed">
        Your words are saved with the card as your own. Later you can write what happened, and set it beside what you sensed.
      </p>
    </div>
  );
}
