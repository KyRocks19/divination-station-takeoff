"use client";

import { useId, useState } from "react";
import { savePrefs, usePrefs } from "@/components/usePrefs";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { ErrorNote } from "@/components/ui/Page";
import { FOCUS_OPTIONS, MAX_FOCUS_LINE } from "@/lib/companion-focus";

/**
 * Choosing what the companion should pay attention to: one of a short list, and a line in the person's own words. Either, both, or neither.
 * Saving, changing, and clearing are all here; `onDone` runs after a save or a clear so the home page card can set itself aside.
 */
export default function CompanionFocusForm({ onDone }: { onDone?: () => void }) {
  const prefs = usePrefs();
  const radioName = useId();
  const lineId = useId();
  const [choice, setChoice] = useState<string | null | undefined>(undefined);
  const [line, setLine] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const shownChoice = choice === undefined ? prefs.companionFocus : choice;
  const shownLine = line === undefined ? prefs.companionFocusLine : line;
  const changed = shownChoice !== prefs.companionFocus || shownLine.trim() !== prefs.companionFocusLine;

  async function save(next: { focus: string | null; line: string }) {
    setBusy(true);
    setError(null);
    setSaved(false);
    const ok = await savePrefs({ companionFocus: next.focus, companionFocusLine: next.line });
    setBusy(false);
    if (!ok) return setError("That could not be saved. Try again.");
    setChoice(undefined);
    setLine(undefined);
    setSaved(true);
    onDone?.();
  }

  return (
    <div className="space-y-3">
      <fieldset className="space-y-2">
        <legend className="text-xs text-ink-faint mb-1">Pick one if it fits, or none. This list is only a convenience.</legend>
        {FOCUS_OPTIONS.map((o) => (
          <label key={o.key} className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name={radioName}
              checked={shownChoice === o.key}
              onChange={() => { setChoice(o.key); setSaved(false); }}
              className="accent-tone-600 mt-1"
            />
            <span>
              <span className="text-sm text-ink-soft">{o.label}</span>
              <span className="block text-xs text-ink-faint">{o.help}</span>
            </span>
          </label>
        ))}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="radio"
            name={radioName}
            checked={shownChoice === null}
            onChange={() => { setChoice(null); setSaved(false); }}
            className="accent-tone-600 mt-1"
          />
          <span className="text-sm text-ink-soft">None of these</span>
        </label>
      </fieldset>

      <div>
        <label htmlFor={lineId} className="block text-xs text-ink-faint mb-1">In your own words, what do you want from it? (optional)</label>
        <Textarea
          id={lineId}
          rows={2}
          maxLength={MAX_FOCUS_LINE}
          value={shownLine}
          onChange={(e) => { setLine(e.target.value); setSaved(false); }}
          placeholder="For example: I want to trust what I notice before I explain it."
        />
        <p className="text-xs text-ink-ghost mt-1">
          Sent to the companion with your requests, as your words. You can see it in &ldquo;Show what would be sent&rdquo;, change it, or clear it at any time.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={busy || !changed} onClick={() => save({ focus: shownChoice ?? null, line: shownLine })}>{busy ? "Saving…" : "Save"}</Button>
        {(prefs.companionFocus || prefs.companionFocusLine) && (
          <Button variant="quiet" disabled={busy} onClick={() => save({ focus: null, line: "" })}>Clear it</Button>
        )}
        {saved && <span role="status" className="text-xs text-success">Saved</span>}
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
    </div>
  );
}
