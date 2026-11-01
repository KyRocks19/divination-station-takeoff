"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";

/**
 * An admin's note on one source (migration 097). Everyone sees the note; an admin also gets a button to add, change or
 * remove it. The note is shared with everyone on this copy, so the editor says so.
 */
export default function SourceNote({
  sourceId,
  sourceName,
  note,
  isAdmin,
  max,
}: {
  sourceId: string;
  sourceName: string;
  note: string | null;
  isAdmin: boolean;
  max: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fieldId = `note-${sourceId}`;

  async function save(text: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/source-notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId, note: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(`Could not save: ${data.error ?? "something went wrong"}. Your text is still here; try again.`);
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError("Could not reach the app. Your text is still here; try again.");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="space-y-2">
        <label htmlFor={fieldId} className="block text-xs text-ink-muted">
          Your note on {sourceName}. Everyone signed in to this copy of the app will see it.
        </label>
        <Textarea id={fieldId} rows={4} maxLength={max} value={draft} onChange={(e) => setDraft(e.target.value)} />
        {error && (
          <p role="alert" className="text-xs text-danger-ink">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => save(draft)} disabled={saving}>
            {saving ? "Saving…" : "Save note"}
          </Button>
          {note && (
            <Button variant="quiet" onClick={() => save("")} disabled={saving}>
              Remove note
            </Button>
          )}
          <Button
            variant="quiet"
            onClick={() => {
              setDraft(note ?? "");
              setError(null);
              setEditing(false);
            }}
            disabled={saving}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {note && (
        <p className="text-sm text-ink-muted leading-relaxed whitespace-pre-line">
          <span className="font-medium text-ink-strong">Admin&apos;s note: </span>
          {note}
        </p>
      )}
      {isAdmin && (
        <Button variant="text" className="min-h-6" onClick={() => setEditing(true)} aria-label={`${note ? "Edit note" : "Add a note"} on ${sourceName}`}>
          {note ? "Edit note" : "Add a note"}
        </Button>
      )}
    </div>
  );
}
