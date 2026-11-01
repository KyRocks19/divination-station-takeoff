"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import MotionAsk from "@/components/pendulum/MotionAsk";

interface Props {
  /** Whether to show the short explanation (the person's "Explanations" setting). */
  hints: boolean;
}

/** Asks for an optional question, then lets the pendulum swing: the app picks a swing and saves the answer. */
export default function AskForm({ hints }: Props) {
  const router = useRouter();
  const questionId = useId();
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (asking) return;
    setAsking(true);
    setError(null);
    try {
      const res = await fetch("/api/pendulum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(typeof body?.error === "string" ? body.error : "");
      }
      const saved = await res.json();
      router.push(`/pendulum/${saved.id}`);
    } catch (err) {
      setError(
        (err instanceof Error && err.message) || "Could not ask the pendulum. Nothing was saved; your question is still here."
      );
      setAsking(false);
    }
  }

  return (
    <form onSubmit={ask} className="bg-surface border border-line rounded-card p-5 space-y-4">
      <div>
        <label htmlFor={questionId} className="block text-xs text-ink-faint mb-1">
          Your question or intention (optional)
        </label>
        <textarea
          id={questionId}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={2}
          className="w-full bg-field border border-line-strong rounded-control px-3 py-2 min-h-11 sm:min-h-0 text-sm text-ink-strong focus:outline-none focus:border-focus resize-y leading-relaxed"
        />
      </div>
      {hints && (
        <p className="text-xs text-ink-faint leading-relaxed">
          The app picks one of your swings by chance, using the random method chosen in Settings. What the swing
          means is up to you. The answer is saved, so you can come back to it.
        </p>
      )}
      <button
        type="submit"
        disabled={asking}
        className="bg-blush hover:bg-blush-soft disabled:opacity-40 text-canvas text-sm font-medium px-4 py-2 min-h-11 sm:min-h-0 rounded-lg transition-colors"
      >
        {asking ? "Letting it swing…" : "Let it swing"}
      </button>
      {error && <p className="text-xs text-danger" role="alert">{error}</p>}
      <MotionAsk question={question} hints={hints} onSaved={(id) => router.push(`/pendulum/${id}`)} />
    </form>
  );
}
