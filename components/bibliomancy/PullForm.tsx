"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_SOURCES,
  MAX_POOL,
  MAX_PULLS,
  SOURCE_KINDS,
  SOURCE_WORDS,
  UNITS,
  UNIT_WORDS,
  cleanPullCount,
  type SourceKind,
  type Unit,
} from "@/lib/bibliomancy-core";
import { fieldClass } from "@/components/ui/Field";

interface Props {
  hints: boolean;
  /** How many pieces of writing the person has in each place. */
  counts: Record<SourceKind, number>;
}

/** Asks for an optional question, what to pull (a word, a phrase or a sentence), how many and from where, then pulls: the app picks and saves the reading. */
export default function PullForm({ hints, counts }: Props) {
  const router = useRouter();
  const questionId = useId();
  const countId = useId();
  const unitName = useId();
  const [question, setQuestion] = useState("");
  const [unit, setUnit] = useState<Unit>("sentence");
  // Kept as text while typing, so the box can be emptied and retyped.
  const [count, setCount] = useState("1");
  const [sources, setSources] = useState<SourceKind[]>(DEFAULT_SOURCES.filter((k) => counts[k] > 0).length ? DEFAULT_SOURCES : SOURCE_KINDS.filter((k) => counts[k] > 0));
  const [pulling, setPulling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const countNumber = cleanPullCount(count);
  const available = sources.reduce((n, k) => n + counts[k], 0);
  const ok = countNumber !== null && sources.length > 0;

  async function pull(e: React.FormEvent) {
    e.preventDefault();
    if (pulling || !ok) return;
    setPulling(true);
    setError(null);
    try {
      const res = await fetch("/api/bibliomancy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, unit, count: countNumber, sources, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(typeof body?.error === "string" ? body.error : "");
      }
      const saved = await res.json();
      router.push(`/bibliomancy/${saved.id}`);
    } catch (err) {
      setError((err instanceof Error && err.message) || "Could not pull. Nothing was saved; your question is still here.");
      setPulling(false);
    }
  }

  return (
    <form onSubmit={pull} className="bg-surface border border-line rounded-card p-5 space-y-4">
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

      <fieldset className="space-y-2">
        <legend className="text-xs text-ink-faint mb-1">What to pull</legend>
        {UNITS.map((u) => (
          <label key={u} className="flex items-start gap-2 text-sm text-ink-soft min-h-11 sm:min-h-0">
            <input type="radio" name={unitName} checked={unit === u} onChange={() => setUnit(u)} className="mt-1" />
            <span>
              {UNIT_WORDS[u].label}
              <span className="block text-xs text-ink-faint">{UNIT_WORDS[u].hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div>
        <label htmlFor={countId} className="block text-xs text-ink-faint mb-1">
          How many (1 to {MAX_PULLS})
        </label>
        <input
          id={countId}
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_PULLS}
          step={1}
          value={count}
          onChange={(e) => setCount(e.target.value)}
          aria-invalid={countNumber === null}
          className={`w-24 ${fieldClass}`}
        />
        {countNumber === null && <p role="alert" className="text-xs text-danger mt-1">Enter a whole number from 1 to {MAX_PULLS}.</p>}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-xs text-ink-faint mb-1">Where to pull from</legend>
        {SOURCE_KINDS.map((k) => (
          <label key={k} className="flex items-start gap-2 text-sm text-ink-soft min-h-11 sm:min-h-0">
            <input
              type="checkbox"
              checked={sources.includes(k)}
              onChange={(e) => setSources((prev) => (e.target.checked ? SOURCE_KINDS.filter((x) => x === k || prev.includes(x)) : prev.filter((x) => x !== k)))}
              className="mt-1"
            />
            <span>
              {SOURCE_WORDS[k].label} <span className="text-ink-faint">({counts[k]})</span>
              <span className="block text-xs text-ink-faint">{SOURCE_WORDS[k].hint}</span>
            </span>
          </label>
        ))}
        {sources.length === 0 && <p role="alert" className="text-xs text-danger">Choose at least one place.</p>}
        {sources.length > 0 && available === 0 && (
          <p role="status" className="text-xs text-ink-muted">You have no writing in the places chosen yet, so there is nothing to pull from.</p>
        )}
      </fieldset>

      {hints && (
        <p className="text-xs text-ink-faint leading-relaxed">
          The app picks a piece of your writing and a place in it by chance, using the random method chosen in Settings, and shows what it found with the sentence
          around it. Only words you wrote yourself are used: never a line an AI wrote, and never anyone else&apos;s. The numbers show how many pieces of writing you
          have in each place (the newest {MAX_POOL.toLocaleString()} at most). Nothing leaves the app. What a passage means is up to you.
        </p>
      )}

      <button
        type="submit"
        disabled={pulling || !ok || available === 0}
        className="bg-blush hover:bg-blush-soft disabled:opacity-40 text-canvas text-sm font-medium px-4 py-2 min-h-11 sm:min-h-0 rounded-lg transition-colors"
      >
        {pulling ? "Pulling…" : "Pull from my writing"}
      </button>
      {error && <p className="text-xs text-danger" role="alert">{error}</p>}
    </form>
  );
}
