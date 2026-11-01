"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { CAST_METHODS, FIGURES, METHOD_WORDS, dotRows, type CastMethod } from "@/lib/geomancy-data";
import { Select, fieldClass } from "@/components/ui/Field";

const MOTHER_WORDS = ["First Mother", "Second Mother", "Third Mother", "Fourth Mother"];

/** Asks for an optional question and how to cast, then makes the chart: the app casts four Mothers, or the person chooses them. */
export default function ChartForm({ hints }: { hints: boolean }) {
  const router = useRouter();
  const questionId = useId();
  const methodName = useId();
  const [question, setQuestion] = useState("");
  const [method, setMethod] = useState<CastMethod>("random");
  // The four Mothers the person chooses, by figure id; "" until they choose.
  const [chosen, setChosen] = useState<string[]>(["", "", "", ""]);
  const [casting, setCasting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mothersOk = method !== "entered" || chosen.every((v) => v !== "");

  async function cast(e: React.FormEvent) {
    e.preventDefault();
    if (casting || !mothersOk) return;
    setCasting(true);
    setError(null);
    try {
      const res = await fetch("/api/geomancy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          method,
          ...(method === "entered" ? { mothers: chosen } : {}),
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(typeof body?.error === "string" ? body.error : "");
      }
      const saved = await res.json();
      router.push(`/geomancy/${saved.id}`);
    } catch (err) {
      setError((err instanceof Error && err.message) || "Could not make the chart. Nothing was saved; your question is still here.");
      setCasting(false);
    }
  }

  return (
    <form onSubmit={cast} className="bg-surface border border-line rounded-card p-5 space-y-4">
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
        <legend className="text-xs text-ink-faint mb-1">How to cast</legend>
        {CAST_METHODS.map((m) => (
          <label key={m} className="flex items-start gap-2 text-sm text-ink-soft min-h-11 sm:min-h-0">
            <input type="radio" name={methodName} checked={method === m} onChange={() => setMethod(m)} className="mt-1" />
            <span>{METHOD_WORDS[m]}</span>
          </label>
        ))}
      </fieldset>

      {method === "entered" && (
        <fieldset className="space-y-2">
          <legend className="text-xs text-ink-faint mb-1">The four Mothers you cast, the first one first</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {chosen.map((v, i) => (
              <div key={i}>
                <label htmlFor={`${methodName}-mother-${i}`} className="block text-xs text-ink-faint mb-1">
                  {MOTHER_WORDS[i]}
                </label>
                <Select
                  id={`${methodName}-mother-${i}`}
                  value={v}
                  onChange={(e) => setChosen((prev) => prev.map((x, k) => (k === i ? e.target.value : x)))}
                >
                  <option value="">Choose…</option>
                  {FIGURES.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.latin} ({dotRows(f).map((r) => (r === "●" ? "1" : "2")).join("")})
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </div>
          <p className="text-xs text-ink-faint">
            The digits after each name are its four lines from the top (Fire, Air, Water, Earth): 1 is a single dot, 2 a double dot.
          </p>
        </fieldset>
      )}

      {hints && (
        <p className="text-xs text-ink-faint leading-relaxed">
          A chart starts from four figures called the Mothers. The app makes each of their sixteen lines a single or a double dot by chance, using the random
          method chosen in Settings. The four Daughters, four Nieces, two Witnesses, the Judge and the Reconciler then follow by fixed rules, so the whole chart is
          known from the Mothers. What a figure means is up to you. The chart is saved, so you can come back to it.
        </p>
      )}

      <button
        type="submit"
        disabled={casting || !mothersOk}
        className="bg-blush hover:bg-blush-soft disabled:opacity-40 text-canvas text-sm font-medium px-4 py-2 min-h-11 sm:min-h-0 rounded-lg transition-colors"
      >
        {casting ? "Casting…" : method === "entered" ? "Make my chart" : "Cast a chart"}
      </button>
      {error && <p className="text-xs text-danger" role="alert">{error}</p>}
    </form>
  );
}
