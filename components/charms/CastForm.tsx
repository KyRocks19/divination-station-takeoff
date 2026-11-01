"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CHARM_WORDS } from "@/lib/charms-core";
import { fieldClass } from "@/components/ui/Field";
import { buttonClass } from "@/components/ui/Button";

interface Props {
  hints: boolean;
  sets: { id: number; name: string; charms: number }[];
}

/** Asks for an optional question and which set of charms to cast, then casts: the app picks where each lands and saves the reading. */
export default function CastForm({ hints, sets }: Props) {
  const router = useRouter();
  const questionId = useId();
  const setName = useId();
  const usable = sets.filter((s) => s.charms > 0);
  const [question, setQuestion] = useState("");
  const [deckId, setDeckId] = useState<number | null>(usable[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (usable.length === 0) {
    return (
      <div className="bg-surface border border-line rounded-card p-5 space-y-3">
        <p className="text-sm text-ink-muted leading-relaxed">{CHARM_WORDS.noSet}</p>
        <Link href="/oracle" className={buttonClass.text}>Go to the Oracle Deck</Link>
      </div>
    );
  }

  async function cast(e: React.FormEvent) {
    e.preventDefault();
    if (busy || deckId === null) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/charms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, deckId, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(typeof body?.error === "string" ? body.error : "");
      }
      const saved = await res.json();
      router.push(`/charms/${saved.id}`);
    } catch (err) {
      setError((err instanceof Error && err.message) || "Could not cast. Nothing was saved; your question is still here.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={cast} className="bg-surface border border-line rounded-card p-5 space-y-4">
      <div>
        <label htmlFor={questionId} className="block text-xs text-ink-faint mb-1">Your question or intention (optional)</label>
        <textarea id={questionId} value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} className={`w-full ${fieldClass} resize-y leading-relaxed`} />
      </div>
      <div>
        <label htmlFor={setName} className="block text-xs text-ink-faint mb-1">Which set of charms</label>
        <select id={setName} value={deckId ?? ""} onChange={(e) => setDeckId(Number(e.target.value))} className={`w-full ${fieldClass}`}>
          {usable.map((s) => (
            <option key={s.id} value={s.id}>{s.name} ({s.charms} charm{s.charms === 1 ? "" : "s"})</option>
          ))}
        </select>
      </div>
      {hints && <p className="text-xs text-ink-faint leading-relaxed">{CHARM_WORDS.here} Every charm that is not resting is cast.</p>}
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      <button type="submit" disabled={busy || deckId === null} className={buttonClass.primary}>{busy ? "Casting…" : "Cast"}</button>
    </form>
  );
}
