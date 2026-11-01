"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { MAX_OWN_NAME, cleanOwnName } from "@/lib/own-names-core";

interface Props {
  /** The id of the piece, for example "die-knucklebone-a". */
  pieceId: string;
  /** The name the person has already given it, if any. */
  initialName: string | null;
  /** What the piece is called by the app, for the label ("Side A"). */
  label: string;
}

/** The person's own name for a side of a knucklebone. The app gives none; this is only where theirs is kept. */
export default function OwnSideName({ pieceId, initialName, label }: Props) {
  const uid = useId();
  const [saved, setSaved] = useState(initialName ?? "");
  const [draft, setDraft] = useState(initialName ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const api = `/api/own/names/${encodeURIComponent(pieceId)}`;
  const clean = cleanOwnName(draft);
  const changed = (clean ?? "") !== saved;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!clean) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(api, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: clean }) });
      const b = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof b?.error === "string" ? b.error : "Could not save the name.");
      setSaved(clean);
      setDraft(clean);
      setMessage({ ok: true, text: "Name saved." });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Could not save the name. What you typed is still here; try again." });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(api, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setSaved("");
      setDraft("");
      setMessage({ ok: true, text: "Name removed." });
    } catch {
      setMessage({ ok: false, text: "Could not remove the name. Nothing was changed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-2 bg-surface border border-line rounded-card p-4">
      <label htmlFor={`${uid}-name`} className="block text-xs text-ink-faint">
        Your own name for {label} (optional; the app gives none)
      </label>
      <div className="flex flex-wrap gap-2">
        <Input id={`${uid}-name`} value={draft} maxLength={MAX_OWN_NAME} onChange={(e) => { setDraft(e.target.value); setMessage(null); }} autoComplete="off" className="flex-1 min-w-0" />
        <Button type="submit" disabled={busy || !clean || !changed}>Save name</Button>
        {saved && <Button variant="quiet" disabled={busy} onClick={remove}>Remove name</Button>}
      </div>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`text-xs ${message.ok ? "text-ink-faint" : "text-danger"}`}>{message.text}</p>
      )}
    </form>
  );
}
