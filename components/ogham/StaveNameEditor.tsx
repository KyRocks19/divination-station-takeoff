"use client";

import { useId, useState } from "react";
import { getStave } from "@/lib/ogham-data";
import { MAX_OWN_NAME, cleanOwnName } from "@/lib/own-names-core";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

interface Props {
  staveId: string;
  /** The person's own name for the stave, or null when it goes by its medieval name. */
  name: string | null;
  /** Called with the saved name, or null after going back to the medieval name. */
  onSaved: (name: string | null) => void;
}

/** Lets the person call a stave by a name of their own in their draws, or go back to the medieval name. */
export default function StaveNameEditor({ staveId, name, onSaved }: Props) {
  const inputId = useId();
  const stave = getStave(staveId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!stave) return null;
  const api = `/api/own/names/${encodeURIComponent(staveId)}`;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    // An empty box means the medieval name again.
    if (draft.trim() === "") return backToMedieval();
    const clean = cleanOwnName(draft);
    if (!clean) {
      setError(`A name can be up to ${MAX_OWN_NAME} characters.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(api, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: clean }) });
      const b = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof b?.error === "string" ? b.error : "");
      onSaved(clean);
      setDraft(clean);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Could not save the name. What you typed is still here; try again.");
    } finally {
      setBusy(false);
    }
  }

  async function backToMedieval() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(api, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onSaved(null);
      setDraft("");
      setEditing(false);
    } catch {
      setError("Could not remove the name. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <Button variant="text" onClick={() => { setDraft(name ?? ""); setError(null); setEditing(true); }}>
          {name ? "Change your name for it" : "Give it a name of your own"}
        </Button>
        {name && (
          <Button variant="text" disabled={busy} onClick={backToMedieval}>
            {busy ? "Saving…" : `Go back to ${stave.name}`}
          </Button>
        )}
        {error && <p className="text-xs text-danger" role="alert">{error}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={save} className="space-y-2">
      <Field
        htmlFor={inputId}
        label={`Your name for ${stave.name}`}
        hint={`Shown in your draws in place of ${stave.name}. Leave it empty to use ${stave.name} again.`}
        error={error}
      >
        <Input id={inputId} value={draft} maxLength={MAX_OWN_NAME} autoComplete="off" onChange={(e) => setDraft(e.target.value)} autoFocus />
      </Field>
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        <Button variant="quiet" onClick={() => { setEditing(false); setError(null); }}>Cancel</Button>
      </div>
    </form>
  );
}
