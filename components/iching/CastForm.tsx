"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { CAST_METHODS, LINE_VALUES, LINE_WORDS, METHOD_WORDS, type CastMethod } from "@/lib/iching-data";
import { Select, fieldClass } from "@/components/ui/Field";

/** Asks for an optional question and how to cast, then casts: the app tosses coins or counts yarrow stalks, or the person types the six lines they cast. */
export default function CastForm({ hints }: { hints: boolean }) {
  const router = useRouter();
  const questionId = useId();
  const methodName = useId();
  const [question, setQuestion] = useState("");
  const [method, setMethod] = useState<CastMethod>("coins");
  // The six lines the person enters, bottom first; "" until they choose.
  const [entered, setEntered] = useState<string[]>(["", "", "", "", "", ""]);
  const [casting, setCasting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linesOk = method !== "entered" || entered.every((v) => v !== "");

  async function cast(e: React.FormEvent) {
    e.preventDefault();
    if (casting || !linesOk) return;
    setCasting(true);
    setError(null);
    try {
      const res = await fetch("/api/iching", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          method,
          ...(method === "entered" ? { lines: entered.join("") } : {}),
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(typeof body?.error === "string" ? body.error : "");
      }
      const saved = await res.json();
      router.push(`/iching/${saved.id}`);
    } catch (err) {
      setError((err instanceof Error && err.message) || "Could not cast. Nothing was saved; your question is still here.");
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
          <legend className="text-xs text-ink-faint mb-1">Your six lines, from the first (bottom) to the sixth (top)</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {entered.map((v, i) => (
              <div key={i}>
                <label htmlFor={`${methodName}-line-${i}`} className="block text-xs text-ink-faint mb-1">
                  Line {i + 1}{i === 0 ? " (bottom)" : i === 5 ? " (top)" : ""}
                </label>
                <Select
                  id={`${methodName}-line-${i}`}
                  value={v}
                  onChange={(e) => setEntered((prev) => prev.map((x, k) => (k === i ? e.target.value : x)))}
                >
                  <option value="">Choose…</option>
                  {LINE_VALUES.map((n) => (
                    <option key={n} value={String(n)}>
                      {n}: {LINE_WORDS[n]}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </div>
        </fieldset>
      )}

      {hints && (
        <p className="text-xs text-ink-faint leading-relaxed">
          A cast has six lines, the first at the bottom. Each line comes to 6, 7, 8 or 9: 7 and 9 are solid, 6 and 8 are broken, and 6 and 9 are changing, so
          they turn into their opposite in a second hexagram. The app picks with the random method chosen in Settings. Coins and yarrow stalks do not give the
          same odds (coins: 2, 6, 6, 2 chances in 16 for 6, 7, 8, 9; yarrow stalks: 1, 5, 7, 3). What a hexagram means is up to you. The cast is saved, so you can
          come back to it.
        </p>
      )}

      <button
        type="submit"
        disabled={casting || !linesOk}
        className="bg-blush hover:bg-blush-soft disabled:opacity-40 text-canvas text-sm font-medium px-4 py-2 min-h-11 sm:min-h-0 rounded-lg transition-colors"
      >
        {casting ? "Casting…" : method === "entered" ? "Save my cast" : "Cast the I Ching"}
      </button>
      {error && <p className="text-xs text-danger" role="alert">{error}</p>}
    </form>
  );
}
