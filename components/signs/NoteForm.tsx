"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_NOTE_CHARS, NOTE_TYPES, NOTE_WORDS, type NoteType } from "@/lib/signs-core";
import { fieldClass } from "@/components/ui/Field";
import { buttonClass } from "@/components/ui/Button";

/** Asks whether it is a sign or a dream, what happened and on which day (optional), and saves the note. */
export default function NoteForm({ hints }: { hints: boolean }) {
  const router = useRouter();
  const bodyId = useId();
  const dayId = useId();
  const typeName = useId();
  const [type, setType] = useState<NoteType>("sign");
  const [text, setText] = useState("");
  const [day, setDay] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ok = text.trim().length > 0 && text.trim().length <= MAX_NOTE_CHARS;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !ok) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/signs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, body: text, day, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(typeof body?.error === "string" ? body.error : "");
      }
      const saved = await res.json();
      router.push(`/signs/${saved.id}`);
    } catch (err) {
      setError((err instanceof Error && err.message) || "Could not save. Nothing was saved; your text is still here.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="bg-surface border border-line rounded-card p-5 space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-xs text-ink-faint mb-1">What kind of note</legend>
        {NOTE_TYPES.map((t) => (
          <label key={t} className="flex items-center gap-2 text-sm text-ink-soft min-h-11 sm:min-h-0">
            <input type="radio" name={typeName} checked={type === t} onChange={() => setType(t)} />
            {NOTE_WORDS[t].label}
          </label>
        ))}
      </fieldset>
      <div>
        <label htmlFor={bodyId} className="block text-xs text-ink-faint mb-1">{NOTE_WORDS[type].prompt}</label>
        <textarea id={bodyId} value={text} onChange={(e) => setText(e.target.value)} rows={6} maxLength={MAX_NOTE_CHARS} className={`w-full ${fieldClass} resize-y leading-relaxed`} />
        <p className="text-xs text-ink-ghost mt-1">{text.length} of {MAX_NOTE_CHARS} characters</p>
      </div>
      <div>
        <label htmlFor={dayId} className="block text-xs text-ink-faint mb-1">The day it happened (optional)</label>
        <input id={dayId} type="date" value={day} onChange={(e) => setDay(e.target.value)} className={fieldClass} />
      </div>
      {hints && <p className="text-xs text-ink-faint leading-relaxed">The app does not say what a sign or a dream means. After saving you can add what you make of it, and come back later to write what followed.</p>}
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      <button type="submit" disabled={busy || !ok} className={buttonClass.primary}>{busy ? "Saving…" : "Save the note"}</button>
    </form>
  );
}
