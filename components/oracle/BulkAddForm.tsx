"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/ui/Button";
import { fieldFullClass } from "@/components/ui/Field";
import { MAX_LOT_NAME, MAX_PASTE_NAMES, namesFromText } from "@/lib/lots-core";
import { formWords, type SetForm } from "@/lib/oracle-forms";

/** Adds many items to a set at once from a pasted list, one name to a line, so a bag of lots can be filled in one go. */
export default function BulkAddForm({ deckId, form }: { deckId: number; form?: SetForm }) {
  const w = formWords(form);
  const router = useRouter();
  const boxId = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const parsed = namesFromText(text);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (busy || parsed.names.length === 0) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/oracle/cards/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deck_id: deckId, names: text }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "");
      const left = [data.repeats ? `${data.repeats} repeated` : "", data.tooLong ? `${data.tooLong} too long` : "", data.over ? `${data.over} over the limit` : ""].filter(Boolean);
      setMessage(`Added ${data.added} ${data.added === 1 ? w.one : w.many}${left.length ? `; left out: ${left.join(", ")}` : ""}.`);
      setText("");
      router.refresh();
    } catch (err) {
      setError((err instanceof Error && err.message) || `Could not add them. Your list is still here; try again.`);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonClass.text}>
        Add many {w.many} at once
      </button>
    );
  }

  return (
    <form onSubmit={add} className="bg-surface border border-line rounded-card p-5 space-y-3">
      <label htmlFor={boxId} className="block text-sm text-ink-muted uppercase tracking-widest">Names, one to a line</label>
      <textarea id={boxId} value={text} onChange={(e) => setText(e.target.value)} rows={8} className={`${fieldFullClass} resize-y leading-relaxed`} />
      <p className="text-xs text-ink-faint leading-relaxed">
        Each line becomes {w.a} with that name; you can write on it later. Up to {MAX_PASTE_NAMES} at a time, {MAX_LOT_NAME} characters each. Blank lines and names repeated in this list are left out.
      </p>
      <p className="text-xs text-ink-muted" aria-live="polite">
        {parsed.names.length === 0 ? "Nothing to add yet." : `Ready to add ${parsed.names.length} ${parsed.names.length === 1 ? w.one : w.many}.`}
        {parsed.repeats > 0 ? ` ${parsed.repeats} repeated.` : ""}
        {parsed.tooLong > 0 ? ` ${parsed.tooLong} too long.` : ""}
        {parsed.over > 0 ? ` ${parsed.over} over the limit.` : ""}
      </p>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      {message && <p role="status" className="text-xs text-ink-muted">{message}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy || parsed.names.length === 0} className={buttonClass.primary}>{busy ? "Adding…" : `Add ${parsed.names.length || ""} ${w.many}`.replace("  ", " ")}</button>
        <button type="button" onClick={() => { setOpen(false); setMessage(null); setError(null); }} className={buttonClass.quiet}>Close</button>
      </div>
    </form>
  );
}
