"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_DRAW } from "@/lib/runes-data";
import LayoutPicker, { type LayoutChoice } from "@/components/LayoutPicker";
import { fieldClass } from "@/components/ui/Field";

interface Props {
  /** Whether to show the short explanation (the person's "Explanations" setting). */
  hints: boolean;
  /** The person's saved choice about upside-down runes. */
  reversals: boolean;
  chance: number;
  /** The person's own layouts. */
  layouts: LayoutChoice[];
}


/** Asks for an optional question and how many runes, then draws them: the app picks and saves the draw. */
export default function DrawForm({ hints, reversals: savedReversals, chance: savedChance, layouts }: Props) {
  const router = useRouter();
  const questionId = useId();
  const countId = useId();
  const chanceId = useId();
  const [question, setQuestion] = useState("");
  // Kept as text while typing, so a box can be emptied and retyped.
  const [count, setCount] = useState("1");
  const [reversals, setReversals] = useState(savedReversals);
  const [chance, setChance] = useState(String(savedChance));
  const [layout, setLayout] = useState<LayoutChoice | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const countNumber = Number(count);
  // With a layout, one rune is drawn for each position, so the number is not asked for.
  const countOk = layout !== null || (Number.isInteger(countNumber) && countNumber >= 1 && countNumber <= MAX_DRAW);
  const chanceNumber = Number(chance);
  const chanceOk = chance.trim() !== "" && Number.isInteger(chanceNumber) && chanceNumber >= 0 && chanceNumber <= 100;

  async function draw(e: React.FormEvent) {
    e.preventDefault();
    if (drawing || !countOk || (reversals && !chanceOk)) return;
    setDrawing(true);
    setError(null);
    try {
      const res = await fetch("/api/runes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          ...(layout ? { layoutId: layout.id } : { count: countNumber }),
          reversals,
          ...(chanceOk ? { chance: chanceNumber } : {}),
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(typeof body?.error === "string" ? body.error : "");
      }
      const saved = await res.json();
      router.push(`/runes/${saved.id}`);
    } catch (err) {
      setError((err instanceof Error && err.message) || "Could not draw. Nothing was saved; your question is still here.");
      setDrawing(false);
    }
  }

  return (
    <form onSubmit={draw} className="bg-surface border border-line rounded-card p-5 space-y-4">
      <div>
        <label htmlFor={questionId} className="block text-xs text-ink-faint mb-1">
          Your question or intention (optional)
        </label>
        <textarea
          id={questionId}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={2}
          className={`w-full ${fieldClass} resize-y leading-relaxed`}
        />
      </div>

      <LayoutPicker
        layouts={layouts}
        value={layout?.id ?? null}
        setSize={MAX_DRAW}
        things="runes"
        onChange={(l) => {
          setLayout(l);
          // The layout's own starting question fills an empty box; it never replaces what the person wrote.
          if (l?.question && !question.trim()) setQuestion(l.question);
        }}
      />

      {!layout && (
      <div>
        <label htmlFor={countId} className="block text-xs text-ink-faint mb-1">
          How many runes (1 to {MAX_DRAW})
        </label>
        <input
          id={countId}
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_DRAW}
          step={1}
          value={count}
          onChange={(e) => setCount(e.target.value)}
          aria-invalid={!countOk}
          className={`w-24 ${fieldClass}`}
        />
        {!countOk && <p role="alert" className="text-xs text-danger mt-1">Enter a whole number from 1 to {MAX_DRAW}.</p>}
      </div>
      )}

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input type="checkbox" checked={reversals} onChange={(e) => setReversals(e.target.checked)} />
          Runes can land upside down
        </label>
        {reversals && (
          <div>
            <label htmlFor={chanceId} className="block text-xs text-ink-faint mb-1">
              Chance out of 100 that a rune lands upside down
            </label>
            <input
              id={chanceId}
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              step={1}
              value={chance}
              onChange={(e) => setChance(e.target.value)}
              aria-invalid={!chanceOk}
              className={`w-24 ${fieldClass}`}
            />
            {!chanceOk && <p role="alert" className="text-xs text-danger mt-1">Enter a whole number from 0 to 100.</p>}
          </div>
        )}
      </div>

      {hints && (
        <p className="text-xs text-ink-faint leading-relaxed">
          The app picks from the 24 runes of the Elder Futhark by chance, using the random method chosen in Settings.
          A rune comes up at most once in a draw. Some runes look the same upside down, so they never land that way.
          What a rune means is up to you. The draw is saved, so you can come back to it.
        </p>
      )}

      <button
        type="submit"
        disabled={drawing || !countOk || (reversals && !chanceOk)}
        className="bg-blush hover:bg-blush-soft disabled:opacity-40 text-canvas text-sm font-medium px-4 py-2 min-h-11 sm:min-h-0 rounded-lg transition-colors"
      >
        {drawing ? "Drawing…" : "Draw some runes"}
      </button>
      {error && <p className="text-xs text-danger" role="alert">{error}</p>}
    </form>
  );
}
