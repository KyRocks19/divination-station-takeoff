"use client";

import { useAiReady } from "@/components/AiReady";
import { useId, useState } from "react";
import { savePrefs, usePrefs } from "@/components/usePrefs";
import { useCompanionJobs } from "@/components/useCompanionJobs";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import AddToDay from "@/components/AddToDay";
import { ErrorNote, SectionLabel } from "@/components/ui/Page";
import { parseDate } from "@/lib/date";
import { MODE_BUTTONS, MODE_HELP, MODE_TITLES, type CompanionMode } from "@/lib/companion-modes";

/** The plain explanation shown before the companion is switched on, and again in Settings. */
export function CompanionExplanation() {
  return (
    <div className="space-y-2 text-sm text-ink-soft leading-relaxed">
      <p>
        The companion is an AI, a language model. It is not a person. It remembers nothing between requests except the words this app
        hands it, and it does not perceive the world the way you do, so its replies are best read as flashes of thought passing through
        a machine, not as authority.
      </p>
      <p>
        When you press a button for it, the words <em>you wrote</em> about that reading are sent to a model running on the app owner&rsquo;s
        own computer, and to nobody else. You can read exactly what would be sent first. The app does not keep a copy of it, but the
        owner&rsquo;s computer does handle it.
      </p>
      <p>
        It is off until you turn it on. You can turn it off whenever you like, and nothing it says is saved unless you press Keep.
        It will not tell you what your cards mean; it asks, and it works from your own words. If you ask for a reading, it is built only
        from what you wrote and is one way of looking, not the answer.
      </p>
      <p>
        <strong>It is not crisis support.</strong> Before it answers anything, the app checks your words for signs you may be struggling. If it
        sees any, it will pause and say so, and point you to people who can help, instead of answering about your reading. These
        checks are not perfect and cannot catch everything.
      </p>
    </div>
  );
}

/** What a kept answer or a result is called, with the companion's name. */
const resultLabel = (mode: CompanionMode, name: string) =>
  mode === "questions" ? `Asked by ${name}, an AI.` : mode === "changes" ? "Your own words, in the order you wrote them. Put together by the app; no AI wrote any of it." : `${MODE_TITLES[mode]}, written by ${name}, an AI.`;

/**
 * On a reading's page (an oracle pull, or a reading with runes, ogham, dice, the I Ching, geomancy, bibliomancy, playing cards, charms, signs and dreams, tea leaves, ink blots, the pendulum, or scrying): an invitation while the companion is off;
 * when it is on, a way to ask it for questions, for what has changed, or for a reading built from the person's own words.
 */
function CompanionPanelInner({ divinationId }: { divinationId: number }) {
  const prefs = usePrefs();
  const headingId = useId();
  const [reading, setReading] = useState(false);
  const [busyOn, setBusyOn] = useState(false);
  const [onError, setOnError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ mode: CompanionMode; text: string; truncated: boolean; characters: number; focus?: string | null } | null>(null);
  const [showing, setShowing] = useState<CompanionMode | null>(null);
  const c = useCompanionJobs({ divinationId }, prefs.companionEnabled, true);

  async function turnOn() {
    setBusyOn(true);
    setOnError(null);
    const ok = await savePrefs({ companionEnabled: true });
    if (!ok) setOnError("That could not be saved. Try again.");
    setBusyOn(false);
  }

  async function toggleSent(mode: CompanionMode) {
    if (showing === mode) return setShowing(null);
    setShowing(mode);
    c.setError(null);
    try {
      const res = await fetch(`/api/companion/preview?divination_id=${divinationId}&mode=${mode}`);
      if (!res.ok) throw new Error();
      setPreview({ mode, ...(await res.json()) });
    } catch {
      c.setError("That could not be loaded. Try again.");
      setShowing(null);
    }
  }

  if (!prefs.companionEnabled) {
    return (
      <section aria-labelledby={headingId} className="space-y-3">
        <SectionLabel id={headingId}>A companion for this reading?</SectionLabel>
        <Card pad="sm" className="space-y-3">
          <p className="text-sm text-ink-soft">
            You can switch on an AI companion that asks you questions about what you wrote. It is off, and nothing is sent anywhere.
          </p>
          <button className="text-xs text-accent-ink hover:text-accent-ink-hover" onClick={() => setReading(!reading)} aria-expanded={reading}>
            {reading ? "Hide how it works" : "Read how it works"}
          </button>
          {reading && (
            <>
              <CompanionExplanation />
              <Button disabled={busyOn} onClick={turnOn}>Turn on the companion</Button>
            </>
          )}
          {onError && <ErrorNote>{onError}</ErrorNote>}
        </Card>
      </section>
    );
  }

  // Tarot readings are not supported yet: nothing to offer there.
  if (c.caps && !c.caps.supported) return null;

  const name = prefs.companionName;
  const asleep = c.listing.mode === "queue" && c.listing.studio && !c.listing.studio.awake;
  const modes: CompanionMode[] = ["questions", ...(c.caps?.changes ? (["changes"] as const) : []), "reading"];
  const jobBusy = c.busy || c.waiting;

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <SectionLabel id={headingId}>{name}</SectionLabel>
      <Card pad="sm" className="space-y-3">
        <p className="text-sm text-ink-soft">
          {name} is an AI. It works only from your own words and never tells you what anything means. Nothing it says is saved unless you press
          Keep.
        </p>

        {c.immediate && (
          <div role="status" className="border-l-2 border-warning pl-3 space-y-2">
            <p className="whitespace-pre-wrap text-sm text-ink-strong leading-relaxed">{c.immediate.text}</p>
            <div className="flex gap-4">
              {c.immediate.canContinue && <button className={buttonClass.text} disabled={c.busy} onClick={() => c.ask(c.immediate!.mode, true)}>Carry on</button>}
              <button className={buttonClass.text} onClick={() => c.setImmediate(null)}>Close</button>
            </div>
          </div>
        )}

        {c.listing.jobs.map((job) => (
          <div key={job.id} className="border-l-2 border-line-hover pl-3 space-y-2">
            {(job.status === "queued" || job.status === "running") && (
              <>
                <p className="text-sm text-ink-soft" role="status">
                  {job.status === "running"
                    ? `${name} is thinking…`
                    : asleep
                      ? `${name}'s computer is asleep. Your request is waiting and will be answered when it wakes (up to a day).`
                      : job.ahead > 0
                        ? `Waiting for ${name}: ${job.ahead} ahead of you.`
                        : `Waiting for ${name}…`}
                </p>
                <button className={buttonClass.danger} disabled={c.busy} onClick={() => c.remove(job.id, "That could not be cancelled. Try again.")}>Cancel</button>
              </>
            )}
            {job.status === "failed" && (
              <>
                <p className="text-sm text-ink-soft" role="alert">{job.error || "That did not work."}</p>
                <button className={buttonClass.text} disabled={c.busy} onClick={() => c.remove(job.id)}>Dismiss</button>
              </>
            )}
            {job.status === "done" && job.result && (
              <>
                <p className="text-xs text-ink-ghost">{job.action === "questions" || job.action === "reply" ? resultLabel(job.mode, name) : "A pause from the app."}</p>
                <p className="whitespace-pre-wrap text-sm text-ink-strong leading-relaxed">{job.result}</p>
                <div className="flex flex-wrap gap-4">
                  {(job.action === "questions" || job.action === "reply") && (
                    <>
                      <button className={buttonClass.text} disabled={c.busy} onClick={() => c.keep(job.id)}>Keep this</button>
                      <button className={buttonClass.danger} disabled={c.busy} onClick={() => c.remove(job.id, "That could not be discarded. Try again.")}>Discard</button>
                    </>
                  )}
                  {job.action === "checkin" && (
                    <>
                      <button
                        className={buttonClass.text}
                        disabled={c.busy}
                        onClick={async () => {
                          await c.remove(job.id);
                          await c.ask(job.mode, true);
                        }}
                      >
                        Carry on
                      </button>
                      <button className={buttonClass.text} disabled={c.busy} onClick={() => c.remove(job.id)}>Close</button>
                    </>
                  )}
                  {(job.action === "crisis" || job.action === "gentle") && (
                    <button className={buttonClass.text} disabled={c.busy} onClick={() => c.remove(job.id)}>Close</button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}

        <ul className="space-y-2 list-none p-0">
          {modes.map((m) => (
            <li key={m} className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <Button variant={m === "questions" ? "primary" : "quiet"} disabled={jobBusy} onClick={() => c.ask(m)}>{MODE_BUTTONS[m]}</Button>
              <span className="text-xs text-ink-ghost flex-1 min-w-[12rem]">{MODE_HELP[m]}</span>
              {m !== "changes" && (
                <button className="text-xs text-accent-ink hover:text-accent-ink-hover" onClick={() => toggleSent(m)} aria-expanded={showing === m}>
                  {showing === m ? "Hide what would be sent" : "Show what would be sent"}
                </button>
              )}
            </li>
          ))}
        </ul>

        {showing && preview && preview.mode === showing && (
          <div className="space-y-2">
            <pre className="whitespace-pre-wrap break-words text-xs text-ink-faint bg-field border border-line rounded-control p-3 max-h-80 overflow-auto font-sans">
              {preview.text}
            </pre>
            <p className="text-xs text-ink-ghost">
              {preview.characters.toLocaleString()} characters.
              {preview.truncated ? " Some of your older writing was left out to keep it short." : ""} Every line above is something you wrote.
            </p>
            {preview.focus && (
              <>
                <p className="text-xs text-ink-ghost">Also sent with this request, because you set a focus (change it in Settings):</p>
                <pre className="whitespace-pre-wrap break-words text-xs text-ink-faint bg-field border border-line rounded-control p-3 font-sans">{preview.focus}</pre>
              </>
            )}
          </div>
        )}
        {c.error && <ErrorNote>{c.error}</ErrorNote>}

        {c.listing.notes.length > 0 && (
          <div className="space-y-2 border-t border-line-faint pt-3">
            <p className="text-xs text-ink-ghost">What you kept</p>
            {c.listing.notes.map((n) => (
              <div key={n.id} className="border-l-2 border-line-hover pl-3 space-y-1">
                <p className="text-xs text-ink-ghost">
                  {n.mode === "changes"
                    ? `What has changed: your own words, put together by the app, on ${parseDate(n.created_at).toLocaleDateString()}`
                    : `${MODE_TITLES[n.mode] ?? "Answer"}, by ${n.companion_name}, an AI, on ${parseDate(n.created_at).toLocaleDateString()}`}
                </p>
                <p className="whitespace-pre-wrap text-sm text-ink-soft leading-relaxed">{n.content}</p>
                <div className="flex flex-wrap items-center gap-4">
                  <AddToDay kind="companion_note" refId={n.id} />
                  <button className={buttonClass.danger} disabled={c.busy} onClick={() => c.deleteNote(n.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </section>
  );
}

/** Not in the Feathered edition, which has no AI (docs/plan-feathered-edition.md). */
export default function CompanionPanel(props: { divinationId: number }) {
  // Left out when this copy cannot run it (no companion model; always in Feathered): lib/ai-ready-core.ts.
  return useAiReady().companion ? <CompanionPanelInner {...props} /> : null;
}
