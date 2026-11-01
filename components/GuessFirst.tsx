"use client";

import { useId, useState } from "react";
import { parseDate } from "@/lib/date";
import { CONFIDENCE_LABELS, FITS, FIT_LABELS, MAX_FIT_NOTE_LENGTH, MAX_GUESS_LENGTH, type Confidence, type Fit } from "@/lib/guess-core";
import { useGuess } from "@/components/useGuess";
import { useOpening } from "@/components/reveal/reveal-store";
import { usePrefs } from "@/components/usePrefs";
import ReadingExtras from "@/components/ReadingExtras";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Field";
import { ErrorNote, SectionLabel } from "@/components/ui/Page";

interface Props {
  /** The reading's shared record (`divinations.id`). */
  divinationId: number | null | undefined;
  /** True when this tool has meanings that stay closed until the person has written or set the step aside (most tools do). */
  holdsMeanings?: boolean;
}

/**
 * "Write what you sense first": the step before a reading is shown (components/reveal/Reveal.tsx covers it until then, 2026-10-25) and before its
 * meanings. The person writes what they sense the reading holds; the words are sealed when
 * saved. Afterwards they can say how well those words fitted. The app never grades the words or the answer. The companion reads the words only
 * when the person ticks the box for this one reading (owner decision 2026-10-22). Below the card are the reading's other intuition pieces
 * (ReadingExtras: a look-back reminder and the same question asked with other tools), on every reading page.
 */
export default function GuessFirst(props: Props) {
  const { held } = useGuess(props.divinationId);
  return (
    <>
      <GuessCard {...props} />
      <ReadingExtras divinationId={props.divinationId} held={held} />
    </>
  );
}

function GuessCard({ divinationId, holdsMeanings = true }: Props) {
  const g = useGuess(divinationId);
  const textId = useId();
  const logicId = useId();
  const noteId = useId();
  const [text, setText] = useState("");
  const [logic, setLogic] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState(false);
  const [confirmForget, setConfirmForget] = useState(false);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const prefs = usePrefs();
  const opening = useOpening(divinationId);

  const { state } = g;
  if (!state.loaded || (!state.stepOn && !state.guess)) return null;
  // The first impression is asked for after the opening animation, during which the person holds their question in mind.
  if (!state.guess && opening !== "done") return null;

  async function run(action: () => Promise<void>, failure: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error && err.message !== "failed" ? err.message : failure);
    } finally {
      setBusy(false);
    }
  }

  const guess = state.guess;

  if (!guess) {
    return (
      <section aria-labelledby={`${textId}-h`}>
        <Card className="space-y-3">
          <SectionLabel id={`${textId}-h`}>Write what you sense first</SectionLabel>
          <p className="text-sm text-ink-soft leading-relaxed">
            Your reading is covered for now. Before it is shown, write what you sense it holds: a word, a picture, a feeling.
            {" "}If your thinking mind has its own guess, a memory or a story about it, put that in the second box, so the two stay apart. Your words are sealed when you save them, so later you can see how they compare with what you went on to read or what happened. Only you see them.
          </p>
          {/* Side by side from a tablet up: the first impression, and what the thinking mind adds, kept apart so they can be compared later. */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={textId} className="block text-xs text-ink-faint mb-1">What do you sense? (your first impression)</label>
              <Textarea id={textId} rows={4} maxLength={MAX_GUESS_LENGTH} value={text} onChange={(e) => setText(e.target.value)} />
            </div>
            <div>
              <label htmlFor={logicId} className="block text-xs text-ink-faint mb-1">What does your logical mind say? (optional)</label>
              <Textarea id={logicId} rows={4} maxLength={MAX_GUESS_LENGTH} value={logic} onChange={(e) => setLogic(e.target.value)} />
            </div>
          </div>
          <fieldset className="space-y-1">
            <legend className="text-xs text-ink-faint mb-1">
              How sure do you feel? (optional; later you can see whether feeling sure and fitting go together for you)
            </legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {FITS.map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm text-ink-soft min-h-6">
                  <input type="radio" name={`${textId}-sure`} checked={confidence === c} onChange={() => setConfidence(c)} />
                  {CONFIDENCE_LABELS[c]}
                </label>
              ))}
              {confidence !== null && (
                <button type="button" className={`${buttonClass.text} min-h-6`} onClick={() => setConfidence(null)}>Leave it out</button>
              )}
            </div>
          </fieldset>
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={busy || !text.trim()} onClick={() => run(() => g.seal(text, confidence, logic), "That could not be saved. Your words are still here; try again.")}>
              {busy ? "Saving…" : "Seal my words"}
            </Button>
            <Button variant="quiet" disabled={busy} onClick={() => run(g.skip, "That could not be saved. Try again.")}>
              Skip this step for this reading
            </Button>
          </div>
          <p className="text-xs text-ink-faint">{holdsMeanings ? "The reading and its meanings open" : "The reading opens"} once you have sealed your words or skipped.</p>
          {error && <ErrorNote role="alert">{error}</ErrorNote>}
        </Card>
      </section>
    );
  }

  if (guess.skipped) return null;

  return (
    <section aria-label="What you sensed first">
      <Card className="space-y-3">
        <SectionLabel>What you sensed first</SectionLabel>
        <p className="text-sm text-ink-strong leading-relaxed whitespace-pre-wrap break-words">{guess.guess}</p>
        {guess.logic && (
          <div className="border-l-2 border-line pl-3">
            <p className="text-xs text-ink-faint">Your logical mind said</p>
            <p className="text-sm text-ink-soft leading-relaxed whitespace-pre-wrap break-words">{guess.logic}</p>
          </div>
        )}
        <p className="text-xs text-ink-ghost">
          Sealed {parseDate(guess.sealed_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
          {guess.confidence ? ` · how sure you felt: ${CONFIDENCE_LABELS[guess.confidence].toLowerCase()}` : ""}
        </p>
        {(prefs.companionEnabled || guess.companion_ok) && (
          <label className="flex items-start gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              className="mt-1"
              checked={guess.companion_ok}
              disabled={busy}
              onChange={(e) => run(() => g.shareWithCompanion(e.target.checked), "That could not be saved. Nothing changed.")}
            />
            <span>
              Let the companion read these words on this reading
              <span className="block text-xs text-ink-faint">Off unless you tick it. Only this reading; you can untick it at any time.</span>
            </span>
          </label>
        )}

        {rating ? (
          <FitForm
            initial={guess.fit}
            note={note}
            onNote={setNote}
            noteId={noteId}
            busy={busy}
            onSave={(fit) => run(async () => { await g.rate(fit, note); setRating(false); }, "That could not be saved. Try again.")}
            onCancel={() => setRating(false)}
          />
        ) : guess.fit !== null ? (
          <div className="border-t border-line-faint pt-2 space-y-1">
            <p className="text-sm text-ink-soft">How well it fitted: {FIT_LABELS[guess.fit]}</p>
            {guess.fit_note && <p className="text-sm text-ink-faint whitespace-pre-wrap break-words">{guess.fit_note}</p>}
            <button className={buttonClass.text} onClick={() => { setNote(guess.fit_note ?? ""); setRating(true); }}>Change this</button>
          </div>
        ) : (
          <button className={buttonClass.text} onClick={() => { setNote(""); setRating(true); }}>Say how well this fitted</button>
        )}

        <div>
          {confirmForget ? (
            <p className="text-xs text-ink-muted leading-relaxed">
              Forget these words? The step will open again for this reading. This cannot be undone.{" "}
              <button className="text-danger-ink hover:text-danger-soft" disabled={busy} onClick={() => run(async () => { await g.forget(); setConfirmForget(false); }, "That could not be removed. Nothing changed.")}>
                Yes, forget them
              </button>{" "}
              <button className="text-ink-faint hover:text-ink-soft" onClick={() => setConfirmForget(false)}>Cancel</button>
            </p>
          ) : (
            <button className={buttonClass.danger} onClick={() => setConfirmForget(true)}>Forget these words</button>
          )}
        </div>
        {error && <ErrorNote role="alert">{error}</ErrorNote>}
      </Card>
    </section>
  );
}

function FitForm({ initial, note, onNote, noteId, busy, onSave, onCancel }: {
  initial: Fit | null; note: string; onNote: (s: string) => void; noteId: string; busy: boolean; onSave: (fit: Fit) => void; onCancel: () => void;
}) {
  const name = useId();
  const [fit, setFit] = useState<Fit | null>(initial);
  return (
    <div className="border-t border-line-faint pt-2 space-y-2">
      <fieldset className="space-y-1">
        <legend className="text-xs text-ink-faint mb-1">How well did your words fit what you went on to read, or what happened? Only you can say.</legend>
        {FITS.map((f) => (
          <label key={f} className="flex items-center gap-2 text-sm text-ink-soft">
            <input type="radio" name={name} checked={fit === f} onChange={() => setFit(f)} />
            {FIT_LABELS[f]}
          </label>
        ))}
      </fieldset>
      <div>
        <label htmlFor={noteId} className="block text-xs text-ink-faint mb-1">In your own words (optional)</label>
        <Textarea id={noteId} rows={2} maxLength={MAX_FIT_NOTE_LENGTH} value={note} onChange={(e) => onNote(e.target.value)} />
      </div>
      <div className="flex gap-3 items-center">
        <Button disabled={busy || fit === null} onClick={() => fit !== null && onSave(fit)}>{busy ? "Saving…" : "Save"}</Button>
        <Button variant="quiet" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
