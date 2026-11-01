"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_DRAW, cleanDrawCount } from "@/lib/playingcards-data";
import { fieldClass } from "@/components/ui/Field";
import { buttonClass } from "@/components/ui/Button";

/** Asks for an optional question and how many cards, then draws: the app picks and saves the reading. */
export default function DrawForm({ hints }: { hints: boolean }) {
  const router = useRouter();
  const questionId = useId();
  const countId = useId();
  const [question, setQuestion] = useState("");
  const [count, setCount] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const countNumber = cleanDrawCount(count);

  async function draw(e: React.FormEvent) {
    e.preventDefault();
    if (busy || countNumber === null) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/playingcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, count: countNumber, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
      if (!res.ok) throw new Error();
      const saved = await res.json();
      router.push(`/playingcards/${saved.id}`);
    } catch {
      setError("Could not draw. Nothing was saved; your question is still here.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={draw} className="bg-surface border border-line rounded-card p-5 space-y-4">
      <div>
        <label htmlFor={questionId} className="block text-xs text-ink-faint mb-1">Your question or intention (optional)</label>
        <textarea id={questionId} value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} className={`w-full ${fieldClass} resize-y leading-relaxed`} />
      </div>
      <div>
        <label htmlFor={countId} className="block text-xs text-ink-faint mb-1">How many cards (1 to {MAX_DRAW})</label>
        <input
          id={countId}
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_DRAW}
          step={1}
          value={count}
          onChange={(e) => setCount(e.target.value)}
          aria-invalid={countNumber === null}
          className={`w-24 ${fieldClass}`}
        />
        {countNumber === null && <p role="alert" className="text-xs text-danger mt-1">Enter a whole number from 1 to {MAX_DRAW}.</p>}
      </div>
      {hints && (
        <p className="text-xs text-ink-faint leading-relaxed">
          The app draws different cards from a 52-card pack by chance, using the random method chosen in Settings. It says nothing about what a card means: you write that.
        </p>
      )}
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      <button type="submit" disabled={busy || countNumber === null} className={buttonClass.primary}>
        {busy ? "Drawing…" : "Draw"}
      </button>
    </form>
  );
}
