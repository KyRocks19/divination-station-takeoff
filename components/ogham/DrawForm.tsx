"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { maxDraw } from "@/lib/ogham-data";
import LayoutPicker, { type LayoutChoice } from "@/components/LayoutPicker";
import { fieldClass } from "@/components/ui/Field";

interface Props {
  /** Whether to show the short explanation (the person's "Explanations" setting). */
  hints: boolean;
  /** The person's saved choice about the five later letters. */
  forfeda: boolean;
  /** The person's own layouts. */
  layouts: LayoutChoice[];
}


/** Asks for an optional question and how many staves, then draws them: the app picks and saves the draw. */
export default function DrawForm({ hints, forfeda: savedForfeda, layouts }: Props) {
  const router = useRouter();
  const questionId = useId();
  const countId = useId();
  const [question, setQuestion] = useState("");
  // Kept as text while typing, so a box can be emptied and retyped.
  const [count, setCount] = useState("1");
  const [forfeda, setForfeda] = useState(savedForfeda);
  const [layout, setLayout] = useState<LayoutChoice | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const max = maxDraw(forfeda);
  const countNumber = Number(count);
  // With a layout, one stave is drawn for each position, so the number is not asked for.
  const countOk = layout !== null || (count.trim() !== "" && Number.isInteger(countNumber) && countNumber >= 1 && countNumber <= max);

  async function draw(e: React.FormEvent) {
    e.preventDefault();
    if (drawing || !countOk) return;
    setDrawing(true);
    setError(null);
    try {
      const res = await fetch("/api/ogham", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          ...(layout ? { layoutId: layout.id } : { count: countNumber }),
          forfeda,
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(typeof body?.error === "string" ? body.error : "");
      }
      const saved = await res.json();
      router.push(`/ogham/${saved.id}`);
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

      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input type="checkbox" checked={forfeda} onChange={(e) => setForfeda(e.target.checked)} />
        Include the five later letters (forfeda)
      </label>

      <LayoutPicker
        layouts={layouts}
        value={layout?.id ?? null}
        setSize={max}
        things="staves"
        onChange={(l) => {
          setLayout(l);
          // The layout's own starting question fills an empty box; it never replaces what the person wrote.
          if (l?.question && !question.trim()) setQuestion(l.question);
        }}
      />

      {!layout && (
      <div>
        <label htmlFor={countId} className="block text-xs text-ink-faint mb-1">
          How many staves (1 to {max})
        </label>
        <input
          id={countId}
          type="number"
          inputMode="numeric"
          min={1}
          max={max}
          step={1}
          value={count}
          onChange={(e) => setCount(e.target.value)}
          aria-invalid={!countOk}
          className={`w-24 ${fieldClass}`}
        />
        {!countOk && <p role="alert" className="text-xs text-danger mt-1">Enter a whole number from 1 to {max}.</p>}
      </div>
      )}

      {hints && (
        <p className="text-xs text-ink-faint leading-relaxed">
          The app picks from the ogham letters by chance, using the random method chosen in Settings. A stave comes up
          at most once in a draw, and staves never land upside down. What a stave means is up to you. The draw is saved,
          so you can come back to it.
        </p>
      )}

      <button
        type="submit"
        disabled={drawing || !countOk}
        className="bg-blush hover:bg-blush-soft disabled:opacity-40 text-canvas text-sm font-medium px-4 py-2 min-h-11 sm:min-h-0 rounded-lg transition-colors"
      >
        {drawing ? "Drawing…" : "Draw some staves"}
      </button>
      {error && <p className="text-xs text-danger" role="alert">{error}</p>}
    </form>
  );
}
