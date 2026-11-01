"use client";

import { FEATHERED } from "@/lib/edition";
import { useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import { ErrorNote } from "@/components/ui/Page";
import AddToDay from "@/components/AddToDay";
import type { useCompanionJobs } from "@/components/useCompanionJobs";

type Jobs = ReturnType<typeof useCompanionJobs>;

/**
 * "Ask me a question about this" under a pattern on the Patterns page. The counts and dates above it are made in code; this is the one optional part
 * where the companion (an AI) asks the person a question about the pattern, from only their own dates and words. It goes through the same safety
 * checks and the same daily limit as every other request. Nothing it says is saved unless the person adds it to a day; unanswered or unwanted
 * answers go after a day. `jobs` is the page's one shared connection to the companion.
 */
function PatternQuestionInner({ pattern, name, jobs }: { pattern: string; name: string; jobs: Jobs }) {
  const [preview, setPreview] = useState<{ text: string; focus: string | null; truncated: boolean } | null>(null);
  const [showing, setShowing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const job = [...jobs.listing.jobs].reverse().find((j) => j.pattern_ref === pattern);
  const pause = jobs.immediate && jobs.immediate.pattern === pattern ? jobs.immediate : null;
  const asleep = jobs.listing.mode === "queue" && jobs.listing.studio && !jobs.listing.studio.awake;
  const busy = jobs.busy || jobs.waiting;

  async function togglePreview() {
    if (showing) return setShowing(false);
    setShowing(true);
    setPreviewError(null);
    const res = await fetch(`/api/companion/preview?pattern=${encodeURIComponent(pattern)}`).catch(() => null);
    if (!res?.ok) {
      setPreviewError("That could not be loaded. Try again.");
      setShowing(false);
      return;
    }
    const body = await res.json();
    setPreview({ text: body.text, focus: body.focus, truncated: body.truncated });
  }

  return (
    <div className="mt-2 space-y-2">
      {pause && (
        <div role="status" className="border-l-2 border-warning pl-3 space-y-2">
          <p className="whitespace-pre-wrap text-sm text-ink-strong leading-relaxed">{pause.text}</p>
          <div className="flex gap-4">
            {pause.canContinue && <button className={buttonClass.text} disabled={jobs.busy} onClick={() => jobs.ask("pattern", true, pattern)}>Carry on</button>}
            <button className={buttonClass.text} onClick={() => jobs.setImmediate(null)}>Close</button>
          </div>
        </div>
      )}

      {job && (job.status === "queued" || job.status === "running") && (
        <div className="border-l-2 border-line-hover pl-3 space-y-2">
          <p className="text-sm text-ink-soft" role="status">
            {job.status === "running"
              ? "Your companion is thinking…"
              : asleep
                ? "Your companion's computer is asleep. Your question is waiting and will be answered when it wakes (up to a day)."
                : job.ahead > 0
                  ? `Waiting: ${job.ahead} ahead of you.`
                  : "Waiting…"}
          </p>
          <button className={buttonClass.danger} disabled={jobs.busy} onClick={() => jobs.remove(job.id, "That could not be cancelled. Try again.")}>Cancel</button>
        </div>
      )}

      {job?.status === "failed" && (
        <div className="border-l-2 border-line-hover pl-3 space-y-2">
          <p className="text-sm text-ink-soft" role="alert">{job.error || "That did not work."}</p>
          <button className={buttonClass.text} disabled={jobs.busy} onClick={() => jobs.remove(job.id)}>Dismiss</button>
        </div>
      )}

      {job?.status === "done" && job.result && (
        <div className="border-l-2 border-line-hover pl-3 space-y-2">
          <p className="text-xs text-ink-ghost">{job.action === "questions" ? `Questions about ${name}, written by your companion, an AI. They are not saved unless you add them to a day.` : "A pause from the app."}</p>
          <p className="whitespace-pre-wrap text-sm text-ink-strong leading-relaxed">{job.result}</p>
          <div className="flex flex-wrap items-center gap-4">
            {job.action === "questions" && (
              <>
                <AddToDay kind="pattern_answer" refId={job.id} />
                <button className={buttonClass.danger} disabled={jobs.busy} onClick={() => jobs.remove(job.id, "That could not be discarded. Try again.")}>Discard</button>
              </>
            )}
            {job.action === "checkin" && (
              <>
                <button
                  className={buttonClass.text}
                  disabled={jobs.busy}
                  onClick={async () => {
                    await jobs.remove(job.id);
                    await jobs.ask("pattern", true, pattern);
                  }}
                >
                  Carry on
                </button>
                <button className={buttonClass.text} disabled={jobs.busy} onClick={() => jobs.remove(job.id)}>Close</button>
              </>
            )}
            {(job.action === "crisis" || job.action === "gentle") && (
              <button className={buttonClass.text} disabled={jobs.busy} onClick={() => jobs.remove(job.id)}>Close</button>
            )}
          </div>
        </div>
      )}

      {!job && !pause && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <button className={buttonClass.text} disabled={busy} onClick={() => jobs.ask("pattern", false, pattern)}>Ask me a question about this</button>
          <button className="text-xs text-accent-ink underline" onClick={togglePreview}>{showing ? "Hide what would be sent" : "Show what would be sent"}</button>
        </div>
      )}
      {showing && preview && !job && !pause && (
        <div className="space-y-1">
          <pre className="whitespace-pre-wrap break-words text-xs text-ink-faint bg-field border border-line rounded-control p-3 max-h-72 overflow-auto font-sans">{preview.text}</pre>
          <p className="text-xs text-ink-ghost">
            Every line is a date or something you wrote.{preview.truncated ? " Some of the oldest was left out to keep it short." : ""}
            {preview.focus ? " Your focus and note from Settings are also sent." : ""}
          </p>
        </div>
      )}
      {previewError && <ErrorNote>{previewError}</ErrorNote>}
    </div>
  );
}

/** Not in the Feathered edition, which has no AI (docs/plan-feathered-edition.md). */
export default function PatternQuestion(props: { pattern: string; name: string; jobs: Jobs }) {
  return FEATHERED ? null : <PatternQuestionInner {...props} />;
}
