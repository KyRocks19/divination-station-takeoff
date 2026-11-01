"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { TEA_READING_WORDS } from "@/lib/blots-core";
import { TEAS, TEA_WORDS, type TeaKind } from "@/lib/tea-core";
import TeaConcepts from "@/components/tea/TeaConcepts";
import { fieldClass } from "@/components/ui/Field";
import { buttonClass } from "@/components/ui/Button";

/**
 * Asks for an optional question and which tea (2026-10-25), then brews a cup: the app picks the seed and saves the reading. Choosing a tea
 * shows a few concepts to bring to mind while it brews, each a link to its page.
 */
export default function TeaForm({ hints }: { hints: boolean }) {
  const router = useRouter();
  const questionId = useId();
  const teaName = useId();
  const [question, setQuestion] = useState("");
  const [tea, setTea] = useState<TeaKind>("china-black");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function make(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, tea, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
      if (!res.ok) throw new Error();
      const saved = await res.json();
      router.push(`/tea/${saved.id}`);
    } catch {
      setError("Could not brew a cup. Nothing was saved; your question is still here.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={make} className="bg-surface border border-line rounded-card p-5 space-y-4">
      <div>
        <label htmlFor={questionId} className="block text-xs text-ink-faint mb-1">Your question or intention (optional)</label>
        <textarea id={questionId} value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} className={`w-full ${fieldClass} resize-y leading-relaxed`} />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-xs text-ink-faint mb-1">Your tea</legend>
        <p className="text-xs text-ink-faint leading-relaxed">{TEA_WORDS.choose}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {TEAS.map((t) => (
            <label
              key={t.kind}
              className={`flex items-start gap-2 text-sm text-ink-soft rounded-control border p-2 min-h-11 ${tea === t.kind ? "border-line-accent bg-tone-700/20" : "border-line-faint"}`}
            >
              <input type="radio" name={teaName} checked={tea === t.kind} onChange={() => setTea(t.kind)} className="mt-1" />
              <span>
                {t.label}
                <span className="block text-xs text-ink-faint">{t.examples}</span>
              </span>
            </label>
          ))}
        </div>
        <TeaConcepts tea={tea} newTab />
        {hints && <p className="text-xs text-ink-faint leading-relaxed">{TEA_WORDS.source}</p>}
      </fieldset>
      {hints && <p className="text-xs text-ink-faint leading-relaxed">{TEA_READING_WORDS.here}</p>}
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      <button type="submit" disabled={busy} className={buttonClass.primary}>{busy ? "Brewing…" : "Brew and read"}</button>
    </form>
  );
}
