"use client";

import { useId } from "react";
import { usePrefs } from "@/components/usePrefs";
import { useAiReady } from "@/components/AiReady";
import { useCompanionJobs } from "@/components/useCompanionJobs";
import { buttonClass } from "@/components/ui/Button";
import { ErrorNote } from "@/components/ui/Page";

/** The numbered ideas in a reply, without their numbers. */
export function parseIdeas(text: string): string[] {
  return text
    .split(String.fromCharCode(10))
    .map((l) => l.match(/^\s*\d+[.)]\s*(.+?)\s*$/)?.[1])
    .filter((l): l is string => !!l);
}

/**
 * In the picture-maker: asks the companion for a few ideas for a picture, drawn only from the person's own words about the item. Nothing is
 * kept: an idea only goes into the picture box when the person presses "Use this idea", and they can change it there. Shown only while the
 * companion is switched on.
 */
export default function SceneIdeas({ cardId, onUse }: { cardId: number; onUse: (text: string) => void }) {
  const prefs = usePrefs();
  const ai = useAiReady();
  const uid = useId();
  const c = useCompanionJobs({ cardId }, prefs.companionEnabled);
  if (!prefs.companionEnabled || !ai.companion) return null;
  const name = prefs.companionName;
  const asleep = c.listing.mode === "queue" && c.listing.studio && !c.listing.studio.awake;

  return (
    <div className="space-y-2" aria-labelledby={`${uid}-h`}>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" id={`${uid}-h`} className={buttonClass.text} disabled={c.busy || c.waiting} onClick={() => c.ask("scene")}>
          Ask {name} for picture ideas
        </button>
        <span className="text-[11px] text-ink-ghost">Ideas drawn only from your own words about this item. {name} is an AI; nothing is kept.</span>
      </div>

      {c.immediate && (
        <div role="status" className="border-l-2 border-warning pl-3 space-y-2">
          <p className="whitespace-pre-wrap text-sm text-ink-strong leading-relaxed">{c.immediate.text}</p>
          <div className="flex gap-4">
            {c.immediate.canContinue && <button type="button" className={buttonClass.text} disabled={c.busy} onClick={() => c.ask("scene", true)}>Carry on</button>}
            <button type="button" className={buttonClass.text} onClick={() => c.setImmediate(null)}>Close</button>
          </div>
        </div>
      )}

      {c.listing.jobs.map((job) => (
        <div key={job.id} className="border-l-2 border-line-hover pl-3 space-y-2">
          {(job.status === "queued" || job.status === "running") && (
            <>
              <p className="text-sm text-ink-soft" role="status">
                {job.status === "running" ? `${name} is thinking…` : asleep ? `${name}'s computer is asleep. This will wait until it wakes (up to a day).` : `Waiting for ${name}…`}
              </p>
              <button type="button" className={buttonClass.danger} disabled={c.busy} onClick={() => c.remove(job.id, "That could not be cancelled. Try again.")}>Cancel</button>
            </>
          )}
          {job.status === "failed" && (
            <>
              <p className="text-sm text-ink-soft" role="alert">{job.error || "That did not work."}</p>
              <button type="button" className={buttonClass.text} disabled={c.busy} onClick={() => c.remove(job.id)}>Dismiss</button>
            </>
          )}
          {job.status === "done" && job.result && job.action === "reply" && (
            <>
              <p className="text-xs text-ink-ghost">Ideas from {name}, an AI. Change anything you use.</p>
              <ol className="space-y-2 list-none p-0">
                {parseIdeas(job.result).map((idea, i) => (
                  <li key={i} className="flex flex-wrap items-start gap-3">
                    <span className="text-sm text-ink-strong leading-relaxed flex-1 min-w-[14rem]">{idea}</span>
                    <button type="button" className={buttonClass.text} onClick={() => onUse(idea)}>Use this idea</button>
                  </li>
                ))}
              </ol>
              <button type="button" className={buttonClass.danger} disabled={c.busy} onClick={() => c.remove(job.id, "That could not be cleared. Try again.")}>Discard these</button>
            </>
          )}
          {job.status === "done" && job.result && job.action === "checkin" && (
            <>
              <p className="whitespace-pre-wrap text-sm text-ink-strong leading-relaxed">{job.result}</p>
              <div className="flex gap-4">
                <button
                  type="button"
                  className={buttonClass.text}
                  disabled={c.busy}
                  onClick={async () => {
                    await c.remove(job.id);
                    await c.ask("scene", true);
                  }}
                >
                  Carry on
                </button>
                <button type="button" className={buttonClass.text} disabled={c.busy} onClick={() => c.remove(job.id)}>Close</button>
              </div>
            </>
          )}
          {job.status === "done" && job.result && (job.action === "crisis" || job.action === "gentle") && (
            <>
              <p className="whitespace-pre-wrap text-sm text-ink-strong leading-relaxed">{job.result}</p>
              <button type="button" className={buttonClass.text} disabled={c.busy} onClick={() => c.remove(job.id)}>Close</button>
            </>
          )}
        </div>
      ))}
      {c.error && <ErrorNote>{c.error}</ErrorNote>}
    </div>
  );
}
