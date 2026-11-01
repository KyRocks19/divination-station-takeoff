"use client";

import { useId, useState } from "react";
import ReadingShell from "@/components/tools/ReadingShell";
import { IDEOGRAM_FORM, MAX_IMPRESSION_CHARS, OPTION_COUNT, RV_WORDS } from "@/lib/remoteview-core";
import DrawingBoard from "@/components/oracle/DrawingBoard";
import IdeogramPicture from "@/components/remoteview/IdeogramPicture";
import type { Drawing } from "@/lib/oracle-art";
import type { Trial } from "@/lib/remoteview";
import type { DivinationEntry } from "@/lib/divinations";
import type { Sky } from "@/lib/sky";
import { fieldClass } from "@/components/ui/Field";
import { buttonClass } from "@/components/ui/Button";
import { parseDate } from "@/lib/date";
import { revealSpec } from "@/lib/reveal-core";

interface Props {
  initialReading: Trial;
  initialEntries: DivinationEntry[];
  sky: Sky & { recorded: boolean };
}

/** One trial in its three stages: write the impression, choose among the four options, see the target. Each stage shows only what that stage may. */
export default function TrialView({ initialReading, initialEntries, sky }: Props) {
  const [trial, setTrial] = useState(initialReading);
  const impressionId = useId();
  const choiceName = useId();
  const [text, setText] = useState("");
  const [choice, setChoice] = useState<number | null>(null);
  const [ideogram, setIdeogram] = useState<Drawing | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(path: "seal" | "judge", body: object, failed: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/remoteview/${trial.id}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(typeof data?.error === "string" ? data.error : failed);
      }
      setTrial(await res.json());
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : failed);
    } finally {
      setBusy(false);
    }
  }

  const hit = trial.state === "judged" && trial.choice_index === trial.target_index;

  return (
    <ReadingShell
      reveal={revealSpec("remoteview")}
      reading={trial}
      initialEntries={initialEntries}
      sky={sky}
      api={`/api/remoteview/${trial.id}`}
      listHref="/remoteview"
      listLabel="Blind-target practice"
      madeWord="Started"
      noun="trial"
      journalPrompt="What do you notice about this trial?"
      journalHint="You can come back to this later and write what you learned. Your own record, read over time, is the point."
      footerLinks={[
        { href: "/remoteview/new", label: "Start another trial" },
        { href: "/remoteview", label: "All trials and your results" },
      ]}
      toolName="Blind-target practice"
      shareLines={trial.state === "judged" ? [hit ? "I chose the target." : "I chose another option."] : ["A trial in progress."]}
      deleteNote="Delete this trial and what you wrote about it? Its sealed target goes with it."
      guess="off"
      plain
    >
      <section aria-label="The trial" className="space-y-4">
        {trial.state === "open" && drawing && (
          <div className="bg-surface border border-line rounded-card p-5 space-y-3">
            <p className="text-sm text-ink-muted leading-relaxed">
              Draw the first quick marks that come, without thinking about what they are. This is your ideogram; it is sealed with your words.
            </p>
            <DrawingBoard
              form={IDEOGRAM_FORM}
              initial={ideogram}
              saving={false}
              onSave={(d) => { setIdeogram(d.strokes.length > 0 ? d : null); setDrawing(false); }}
              onCancel={() => setDrawing(false)}
            />
          </div>
        )}

        {trial.state === "open" && !drawing && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) send("seal", { impression: text, ideogram }, "Could not seal. Your text and drawing are still here.");
            }}
            className="bg-surface border border-line rounded-card p-5 space-y-3"
          >
            <p className="text-sm text-ink-muted leading-relaxed">
              The target is chosen and hidden, and so are the four options. Write what comes to you: shapes, colours, textures, places, feelings, sounds, in any order. Mark nothing as right or wrong. Mind-chatter and guesses
              can go in too; you may want to put them in brackets so you can see them apart later.
            </p>
            <div className="space-y-2">
              {ideogram && <IdeogramPicture drawing={ideogram} label="Your ideogram" />}
              <div className="flex flex-wrap gap-x-4">
                <button type="button" onClick={() => setDrawing(true)} className={buttonClass.text}>
                  {ideogram ? "Redraw the ideogram" : "Draw a quick ideogram (optional)"}
                </button>
                {ideogram && <button type="button" onClick={() => setIdeogram(null)} className={buttonClass.danger}>Remove the ideogram</button>}
              </div>
            </div>
            <label htmlFor={impressionId} className="block text-xs text-ink-faint">Your first impression</label>
            <textarea id={impressionId} value={text} onChange={(e) => setText(e.target.value)} rows={7} maxLength={MAX_IMPRESSION_CHARS} className={`w-full ${fieldClass} resize-y leading-relaxed`} />
            <p className="text-xs text-ink-faint">Sealing cannot be undone: the words stay exactly as you wrote them.</p>
            <button type="submit" disabled={busy || !text.trim()} className={buttonClass.primary}>{busy ? "Sealing…" : "Seal my impression"}</button>
          </form>
        )}

        {trial.state !== "open" && trial.impression && (
          <div className="bg-surface border border-line rounded-card p-4 space-y-1">
            <p className="text-[11px] text-tone-400 uppercase tracking-widest">
              Your sealed impression
              {trial.sealed_at && <> · <time dateTime={trial.sealed_at}>{parseDate(trial.sealed_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time></>}
            </p>
            <p className="text-base text-ink-strong leading-relaxed whitespace-pre-wrap break-words">{trial.impression}</p>
            {trial.ideogram && <IdeogramPicture drawing={trial.ideogram} label="Your sealed ideogram" />}
          </div>
        )}

        {trial.state === "sealed" && trial.options && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (choice !== null) send("judge", { choice }, "Could not record your choice.");
            }}
            className="bg-surface border border-line rounded-card p-5 space-y-3"
          >
            <fieldset className="space-y-2">
              <legend className="text-sm text-ink-muted mb-1">Which of these does your impression match best?</legend>
              {trial.options.map((o, i) => (
                <label key={i} className="flex items-start gap-2 text-sm text-ink-soft min-h-11 sm:min-h-0">
                  <input type="radio" name={choiceName} checked={choice === i} onChange={() => setChoice(i)} className="mt-1" />
                  <span className="break-words min-w-0">{o}</span>
                </label>
              ))}
            </fieldset>
            <p className="text-xs text-ink-faint">You can choose once. Then the target is shown.</p>
            <button type="submit" disabled={busy || choice === null} className={buttonClass.primary}>{busy ? "Recording…" : "Choose and show the target"}</button>
          </form>
        )}

        {trial.state === "judged" && trial.options && trial.target_index !== null && (
          <div className="bg-surface border border-line rounded-card p-4 space-y-3">
            <p className="text-base text-ink-strong">
              {hit ? "You chose the target." : "You chose another option."}{" "}
              <span className="text-sm text-ink-faint">With four options, guessing alone is right one time in four.</span>
            </p>
            <ol className="list-none p-0 space-y-1">
              {trial.options.map((o, i) => (
                <li key={i} className="text-sm text-ink-soft break-words">
                  <span className="text-ink-faint">{i + 1}.</span> {o}
                  {i === trial.target_index && <strong className="ml-2 text-ink-strong">· the target</strong>}
                  {i === trial.choice_index && <span className="ml-2 text-ink-faint">· your choice</span>}
                </li>
              ))}
            </ol>
          </div>
        )}

        {error && <p role="alert" className="text-xs text-danger">{error}</p>}
        <p className="text-xs text-ink-faint leading-relaxed">
          {RV_WORDS.honest} There are {OPTION_COUNT} options in every trial.
        </p>
      </section>
    </ReadingShell>
  );
}
