"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Surface from "@/components/scrying/Surface";
import {
  MAX_SCRYING_MINUTES,
  parseMinutesText,
  SCRYING_SURFACE_LABELS,
  SCRYING_SURFACES,
  type ScryingSurface,
} from "@/lib/scrying-surfaces";
import { Field, Input } from "@/components/ui/Field";
import CommonMeaningBlock from "@/components/CommonMeaningBlock";
import { COMMON_SOURCES, SCRYING_MEANINGS } from "@/lib/common-meanings-data";
import { buttonClass } from "@/components/ui/Button";

interface Props {
  /** The surface that starts chosen. */
  initialSurface: ScryingSurface;
  /** Whether to show the short explanations (the person's "Explanations" setting). */
  hints: boolean;
}


/**
 * Where a person chooses a surface and looks into it. Nothing is saved until they say they are done looking;
 * then the session is saved and its page opens, where they write what they saw. There is no timer on screen.
 * How long they looked is kept only when the box for it is ticked.
 */
export default function ScryingRoom({ initialSurface, hints }: Props) {
  const router = useRouter();
  const uid = useId();
  const [surface, setSurface] = useState<ScryingSurface>(initialSurface);
  const [question, setQuestion] = useState("");
  const [keepTime, setKeepTime] = useState(true);
  const [looking, setLooking] = useState(false);
  // "Hold it still" stops the slow drift inside the surface. It lasts for this look only.
  const [still, setStill] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The quiet timer: off unless the person types a number. When it runs out it shows one line and makes no sound.
  const [timerText, setTimerText] = useState("");
  const [timerMinutes, setTimerMinutes] = useState<number | null>(null);
  const [timerUp, setTimerUp] = useState(false);
  const startedAt = useRef(0);
  // The form is swapped for the surface, so focus would fall back to the page's start; it goes to the main button instead.
  const doneRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (looking) doneRef.current?.focus({ preventScroll: true });
  }, [looking]);
  const timerBad = timerText.trim() !== "" && parseMinutesText(timerText, 1) === null;

  // Compares clock times rather than counting ticks, so a throttled background tab still ends on time.
  useEffect(() => {
    if (!looking || timerMinutes === null) return;
    const id = setInterval(() => {
      if (Date.now() - startedAt.current >= timerMinutes * 60000) {
        setTimerUp(true);
        clearInterval(id);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [looking, timerMinutes]);

  function open(e: React.FormEvent) {
    e.preventDefault();
    if (timerBad) return;
    startedAt.current = Date.now();
    setTimerMinutes(parseMinutesText(timerText, 1));
    setTimerUp(false);
    setStill(false);
    setError(null);
    setLooking(true);
    window.scrollTo({ top: 0 });
  }

  async function done() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/scrying", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surface,
          question,
          minutes: keepTime ? Math.round((Date.now() - startedAt.current) / 60000) : null,
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      if (!res.ok) throw new Error();
      const saved = await res.json();
      router.push(`/scrying/${saved.id}`);
    } catch {
      setError("Could not save the session. Nothing was saved yet; press the button again.");
      setSaving(false);
    }
  }

  if (looking) {
    return (
      <div className="space-y-5 text-center">
        {question.trim() && (
          <p className="text-sm text-ink-faint leading-relaxed whitespace-pre-wrap break-words">{question.trim()}</p>
        )}
        {/* Sized by the window's height, so the button under the surface stays in view without scrolling. */}
        <Surface surface={surface} moving={!still} className="mx-auto w-full max-w-[min(55vh,34rem)] h-auto" />
        {/* The region is always on the page, so a screen reader notices the text when it is added. */}
        <p role="status" className="text-sm text-ink-muted min-h-5">
          {timerUp && timerMinutes !== null ? `The time you set (${timerMinutes} minute${timerMinutes === 1 ? "" : "s"}) has passed. You can keep looking.` : ""}
        </p>
        <div className="space-y-3">
          <p>
            {/* One label that stays the same; the pressed state says whether it is on. */}
            <button onClick={() => setStill((s) => !s)} className={`${buttonClass.text} sm:inline-flex sm:items-center sm:min-h-6`} aria-pressed={still}>
              Hold it still
            </button>
          </p>
          <button ref={doneRef} onClick={done} disabled={saving} className={buttonClass.primary}>
            {saving ? "Saving…" : "I am done looking"}
          </button>
          <p>
            <Link href="/scrying" className="max-sm:inline-flex max-sm:items-center max-sm:min-h-11 text-xs text-ink-ghost hover:text-ink-muted transition-colors">
              Leave without saving
            </Link>
          </p>
          {error && <p className="text-xs text-danger" role="alert">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={open} className="bg-surface border border-line rounded-card p-5 space-y-5">
      <fieldset className="space-y-3">
        <legend className="text-xs text-ink-faint mb-2">Choose a surface</legend>
        <div className="grid grid-cols-3 gap-3">
          {SCRYING_SURFACES.map((s) => (
            <label
              key={s}
              className={`cursor-pointer rounded-xl border p-3 text-center transition-colors ${
                surface === s ? "border-tone-500 bg-tone-900/20" : "border-line-strong hover:border-line-hover"
              }`}
            >
              <input
                type="radio"
                name={`${uid}-surface`}
                value={s}
                checked={surface === s}
                onChange={() => setSurface(s)}
                className="sr-only"
              />
              <Surface surface={s} moving={false} className="mx-auto w-full max-w-24 h-auto" />
              <span className="block text-xs text-ink-soft mt-2">{SCRYING_SURFACE_LABELS[s]}</span>
            </label>
          ))}
        </div>
        {SCRYING_MEANINGS[`scrying-${surface}`] && (
          <details className="text-sm">
            <summary className="cursor-pointer text-xs text-ink-faint hover:text-ink-soft">
              About the {SCRYING_SURFACE_LABELS[surface].toLowerCase()} (a starting point only)
            </summary>
            <div className="mt-2 bg-surface-sunken rounded-xl p-4 border border-line-faint">
              <CommonMeaningBlock meaning={SCRYING_MEANINGS[`scrying-${surface}`]} source={COMMON_SOURCES.scrying} symbolId={`scrying-${surface}`} />
            </div>
          </details>
        )}
      </fieldset>

      <div>
        <label htmlFor={`${uid}-question`} className="block text-xs text-ink-faint mb-1">
          Your question or intention (optional)
        </label>
        <textarea
          id={`${uid}-question`}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={2}
          className="w-full bg-field border border-line-strong rounded-control px-3 py-2 min-h-11 sm:min-h-0 text-sm text-ink-strong focus:outline-none focus:border-focus resize-y leading-relaxed"
        />
      </div>

      <Field
        htmlFor={`${uid}-timer`}
        label="Quiet timer, in minutes (optional)"
        hint="Leave empty for no timer. When the time has passed, one line of text appears. There is no sound, no vibration and no clock, and you can keep looking."
        error={timerBad ? `Type a whole number of minutes from 1 to ${MAX_SCRYING_MINUTES}, or leave the box empty.` : null}
      >
        <Input
          id={`${uid}-timer`}
          wide={false}
          className="w-24"
          inputMode="numeric"
          autoComplete="off"
          value={timerText}
          onChange={(e) => setTimerText(e.target.value)}
        />
      </Field>

      <label className="flex items-start gap-2 text-xs text-ink-muted cursor-pointer">
        <input
          type="checkbox"
          checked={keepTime}
          onChange={(e) => setKeepTime(e.target.checked)}
          className="accent-tone-600 mt-0.5"
        />
        <span>
          Keep how long I looked. The app counts the minutes from when the surface opens until you say you are
          done. No clock is shown. Only you see the number, and you can remove it afterwards.
        </span>
      </label>

      {hints && (
        <p className="text-xs text-ink-faint leading-relaxed">
          Look for as long as you like. The app does not say what any shape is; what you see is yours. Nothing is
          saved until you press “I am done looking”. Then you can write what you saw.
        </p>
      )}

      <button type="submit" className={buttonClass.primary}>Open the surface</button>
    </form>
  );
}
