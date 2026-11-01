"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { BLOT_WORDS } from "@/lib/blots-core";
import { fieldClass } from "@/components/ui/Field";
import { buttonClass } from "@/components/ui/Button";

/** Asks for an optional question, then presses an ink blot: the app picks the seed and saves the reading. Tea leaves have their own form (components/tea/TeaForm.tsx). */
export default function BlotForm({ hints }: { hints: boolean }) {
  const router = useRouter();
  const questionId = useId();
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function make(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/blots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, vessel: "ink", tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
      if (!res.ok) throw new Error();
      const saved = await res.json();
      router.push(`/blots/${saved.id}`);
    } catch {
      setError("Could not make a blot. Nothing was saved; your question is still here.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={make} className="bg-surface border border-line rounded-card p-5 space-y-4">
      <div>
        <label htmlFor={questionId} className="block text-xs text-ink-faint mb-1">Your question or intention (optional)</label>
        <textarea id={questionId} value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} className={`w-full ${fieldClass} resize-y leading-relaxed`} />
      </div>
      {hints && <p className="text-xs text-ink-faint leading-relaxed">{BLOT_WORDS.here}</p>}
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      <button type="submit" disabled={busy} className={buttonClass.primary}>{busy ? "Pressing…" : "Press a blot"}</button>
    </form>
  );
}
