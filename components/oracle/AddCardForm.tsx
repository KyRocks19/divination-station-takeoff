"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import QuestionPrompt from "@/components/oracle/QuestionPrompt";
import { formWords, type SetForm } from "@/lib/oracle-forms";

interface Props {
  /** The deck the card goes into. null means the person has no deck yet; one is made with the card. */
  deckId: number | null;
  /** Whether to show a question that may help the person think of a card (their Settings choice). */
  showQuestion: boolean;
  /** The set's form, for the words on the page. */
  form?: SetForm;
}

/** Makes a card from a name alone, then opens the card so the person can write on it. */
export default function AddCardForm({ deckId, showQuestion, form }: Props) {
  const w = formWords(form);
  const router = useRouter();
  const inputId = useId();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function addCard(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(false);
    try {
      const res = await fetch("/api/oracle/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deckId ? { name, deck_id: deckId } : { name }),
      });
      if (!res.ok) throw new Error();
      const card = await res.json();
      router.refresh();
      router.push(`/oracle/cards/${card.id}`);
    } catch {
      setError(true);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={addCard} className="bg-surface border border-line rounded-card p-5 space-y-3">
      <label htmlFor={inputId} className="block text-sm text-ink-muted uppercase tracking-widest">
        Name for a new {w.one}
      </label>
      <div className="flex gap-2">
        <input
          id={inputId}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
          className="flex-1 min-w-0 bg-field border border-line-strong rounded-control px-3 py-2 min-h-11 sm:min-h-0 text-sm text-ink-strong focus:outline-none focus:border-focus"
        />
        <button
          type="submit"
          disabled={!name.trim() || saving}
          className="bg-blush hover:bg-blush-soft disabled:opacity-40 text-canvas text-sm font-medium px-4 py-2 min-h-11 sm:min-h-0 rounded-lg transition-colors whitespace-nowrap"
        >
          {saving ? "Adding…" : `Add ${w.one}`}
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-danger">Could not add the {w.one}. The name is still here; try again.</p>}
      {showQuestion && (
        <div className="pt-2">
          <QuestionPrompt set="finding" />
        </div>
      )}
    </form>
  );
}
