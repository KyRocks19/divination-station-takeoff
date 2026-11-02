"use client";

import { useAiReady } from "@/components/AiReady";
import { useEffect, useId, useState } from "react";
import { savePrefs, usePrefs } from "@/components/usePrefs";
import { useCompanionJobs } from "@/components/useCompanionJobs";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { ErrorNote } from "@/components/ui/Page";
import { MAX_NOTE } from "@/lib/companion-focus";
import { MODE_HELP } from "@/lib/companion-modes";

const EXAMPLE = "For example: I like to write down what I notice first, before I work out what it means.";

/**
 * "What I have noticed about how I like to work" (Settings). Three things, kept apart on purpose: the counts the app makes in code (no AI, none of
 * your words), your own note (only you write it; it is sent with companion requests as your words), and an optional suggested line that is only
 * ever shown as the box's placeholder, never saved unless you use it and press Save.
 */
function CompanionNoticedInner() {
  const prefs = usePrefs();
  const noteId = useId();
  const [lines, setLines] = useState<string[] | null>(null);
  const [context, setContext] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [showSent, setShowSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const c = useCompanionJobs({ self: true }, prefs.companionEnabled);

  useEffect(() => {
    fetch("/api/companion/noticed")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setLines(d.lines); setContext(d.context); } })
      .catch(() => {});
  }, []);

  // A finished suggestion becomes the placeholder and the request is cleared; a failed one shows its words.
  const finished = c.listing.jobs.find((j) => j.mode === "noticed" && j.status === "done" && j.result);
  useEffect(() => {
    if (!finished?.result) return;
    setSuggestion(finished.result);
    void c.remove(finished.id);
  }, [finished?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const failed = c.listing.jobs.find((j) => j.mode === "noticed" && j.status === "failed");

  const shown = draft === undefined ? prefs.companionNote : draft;
  const changed = shown.trim() !== prefs.companionNote;

  async function save(next: string) {
    setBusy(true);
    setError(null);
    setSaved(false);
    const ok = await savePrefs({ companionNote: next });
    setBusy(false);
    if (!ok) return setError("That could not be saved. Try again.");
    setDraft(undefined);
    setSaved(true);
  }

  const none = lines !== null && lines.length === 0;
  const waiting = c.listing.jobs.some((j) => j.mode === "noticed" && (j.status === "queued" || j.status === "running"));

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-xs text-ink-faint">Counted by the app from your readings. No AI is involved, and none of your words are used.</p>
        {lines === null ? (
          <p className="text-sm text-ink-ghost">Counting…</p>
        ) : none ? (
          <p className="text-sm text-ink-muted">Nothing to count yet. Make a reading and it will show here.</p>
        ) : (
          <ul className="text-sm text-ink-soft space-y-0.5 list-disc pl-5">
            {lines.map((l) => <li key={l}>{l}</li>)}
          </ul>
        )}
      </div>

      <div>
        <label htmlFor={noteId} className="block text-xs text-ink-faint mb-1">Your own note about how you like to work (optional)</label>
        <Textarea
          id={noteId}
          rows={3}
          maxLength={MAX_NOTE}
          value={shown}
          onChange={(e) => { setDraft(e.target.value); setSaved(false); }}
          placeholder={suggestion ?? EXAMPLE}
        />
        <p className="text-xs text-ink-ghost mt-1">
          Only you write this. If you save it, it is sent with your companion requests as your words, and you can see it in &ldquo;Show what would be sent&rdquo;.
          You can change it or clear it at any time.
        </p>
      </div>

      {suggestion && (
        <div className="space-y-2 bg-field border border-line rounded-control p-3">
          <p className="text-xs text-ink-faint">A line the companion suggested, an AI, from the counts above. It is not saved:</p>
          <p className="text-sm text-ink-soft">{suggestion}</p>
          <div className="flex gap-2">
            <Button variant="quiet" onClick={() => { setDraft(shown.trim() ? `${shown.trim()} ${suggestion}` : suggestion); setSuggestion(null); setSaved(false); }}>Use this line</Button>
            <Button variant="quiet" onClick={() => setSuggestion(null)}>Not this one</Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={busy || !changed} onClick={() => save(shown)}>{busy ? "Saving…" : "Save"}</Button>
        {prefs.companionNote && <Button variant="quiet" disabled={busy} onClick={() => save("")}>Clear it</Button>}
        {prefs.companionEnabled && !none && (
          <Button variant="quiet" disabled={c.busy || waiting} onClick={() => c.ask("noticed")}>{waiting ? "Asking…" : "Suggest a line"}</Button>
        )}
        {saved && <span role="status" className="text-xs text-success">Saved</span>}
      </div>
      {prefs.companionEnabled && !none && <p className="text-xs text-ink-ghost">{MODE_HELP.noticed}</p>}
      {!prefs.companionEnabled && <p className="text-xs text-ink-ghost">Turn the companion on, above, if you would like it to suggest a line.</p>}

      {context && prefs.companionEnabled && (
        <div className="space-y-1">
          <button className="text-xs text-accent-ink underline" onClick={() => setShowSent((v) => !v)}>
            {showSent ? "Hide what would be sent" : "Show what would be sent to suggest a line"}
          </button>
          {showSent && <pre className="whitespace-pre-wrap break-words text-xs text-ink-faint bg-field border border-line rounded-control p-3 font-sans">{context}</pre>}
        </div>
      )}

      {failed && (
        <div className="space-y-1">
          <ErrorNote>{failed.error ?? "The companion could not suggest a line just now."}</ErrorNote>
          <Button variant="quiet" onClick={() => c.remove(failed.id)}>Close</Button>
        </div>
      )}
      {(error || c.error) && <ErrorNote>{error ?? c.error}</ErrorNote>}
    </div>
  );
}

/** Not in the Feathered edition, which has no AI (docs/plan-feathered-edition.md). */
export default function CompanionNoticed() {
  // Left out when this copy cannot run it (no companion model; always in Feathered): lib/ai-ready-core.ts.
  return useAiReady().companion ? <CompanionNoticedInner /> : null;
}
