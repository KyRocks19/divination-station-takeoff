"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import LayoutPicker, { type LayoutChoice } from "@/components/LayoutPicker";
import ShuffleOverlay, { shuffleWait } from "@/components/ShuffleOverlay";
import { wantsLessMotion } from "@/lib/less-motion";
import PutBack from "@/components/oracle/PutBack";
import { formWords, type SetForm } from "@/lib/oracle-forms";
import { MAX_DRAW_LOTS, cleanLotCount } from "@/lib/lots-core";

/** How long the shuffle moment lasts at least, in milliseconds. The pull itself is made while it plays. */

interface Props {
  deckId: number;
  /** Whether to show the short explanation (the person's "Explanations" setting). */
  hints: boolean;
  /** The person's own layouts. */
  layouts: LayoutChoice[];
  /** How many items in the set can come up (the ones that are not resting). */
  waking: number;
  /** The set's form, for the words on the page. */
  form?: SetForm;
  /** How many items are resting (set aside). */
  resting?: number;
}

/** Asks for an optional question and a layout, then pulls cards from the deck and opens the saved pull. */
export default function PullForm({ deckId, hints, layouts, waking, form, resting = 0 }: Props) {
  const w = formWords(form);
  const router = useRouter();
  const questionId = useId();
  const countId = useId();
  const [count, setCount] = useState("1");
  const [setAside, setSetAside] = useState(false);
  const [question, setQuestion] = useState("");
  const [layout, setLayout] = useState<LayoutChoice | null>(null);
  const [pulling, setPulling] = useState(false);
  const [shuffling, setShuffling] = useState(false);
  const skipShuffle = useRef<() => void>(() => {});
  const [error, setError] = useState<string | null>(null);

  // With a layout the layout decides how many; without one the person can take several at once.
  const countNumber = cleanLotCount(count, waking);
  const maxCount = Math.min(MAX_DRAW_LOTS, waking);

  async function pull(e: React.FormEvent) {
    e.preventDefault();
    if (pulling || (!layout && countNumber === null)) return;
    setPulling(true);
    setError(null);
    // A person who asked for less motion sees no shuffle, feels no buzz, and does not wait for an animation.
    const calm = wantsLessMotion();
    if (!calm) {
      setShuffling(true);
      if ("vibrate" in navigator) navigator.vibrate([40, 25, 40, 25, 40, 25, 100]);
    }
    const wait = shuffleWait(calm);
    skipShuffle.current = wait.skip;
    try {
      // The pull is made while the shuffle plays; the page moves on when both are done ("I am ready" ends the shuffle early).
      const [res] = await Promise.all([
        fetch("/api/oracle/pulls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deck_id: deckId,
            question,
            ...(layout ? { layoutId: layout.id } : { count: countNumber }),
            ...(setAside ? { setAside: true } : {}),
            tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        }),
        wait.done,
      ]);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(typeof body?.error === "string" ? body.error : "");
      }
      const saved = await res.json();
      router.push(`/oracle/pulls/${saved.id}`);
    } catch (err) {
      setError((err instanceof Error && err.message) || `Could not pull the ${w.many}. Nothing was saved; your question is still here.`);
      setPulling(false);
      setShuffling(false);
    }
  }

  return (
    <form onSubmit={pull} className="bg-surface border border-line rounded-card p-5 space-y-4">
      {shuffling && <ShuffleOverlay count={layout ? layout.positions.length : countNumber ?? 1} group={w.group} one={w.one} many={w.many} onSkip={() => skipShuffle.current()} />}
      <div>
        <label htmlFor={questionId} className="block text-xs text-ink-faint mb-1">
          Your question or intention (optional)
        </label>
        <textarea
          id={questionId}
          autoFocus
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={2}
          className="w-full bg-field border border-line-strong rounded-control px-3 py-2 min-h-11 sm:min-h-0 text-sm text-ink-strong focus:outline-none focus:border-focus resize-y leading-relaxed"
        />
      </div>
      <LayoutPicker
        layouts={layouts}
        value={layout?.id ?? null}
        setSize={waking}
        things={w.many}
        onChange={(l) => {
          setLayout(l);
          // The layout's own starting question fills an empty box; it never replaces what the person wrote.
          if (l?.question && !question.trim()) setQuestion(l.question);
        }}
      />
      {!layout && waking > 1 && (
        <div>
          <label htmlFor={countId} className="block text-xs text-ink-faint mb-1">
            How many {w.many} to draw (1 to {maxCount})
          </label>
          <input
            id={countId}
            type="number"
            inputMode="numeric"
            min={1}
            max={maxCount}
            step={1}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            aria-invalid={countNumber === null}
            className="w-24 bg-field border border-line-strong rounded-control px-3 py-2 min-h-11 sm:min-h-0 text-sm text-ink-strong focus:outline-none focus:border-focus"
          />
          {countNumber === null && <p role="alert" className="text-xs text-danger mt-1">Enter a whole number from 1 to {maxCount}.</p>}
        </div>
      )}
      <label className="flex items-start gap-2 text-sm text-ink-soft min-h-11 sm:min-h-0">
        <input type="checkbox" checked={setAside} onChange={(e) => setSetAside(e.target.checked)} className="mt-1" />
        <span>
          Set aside what is drawn
          <span className="block text-xs text-ink-faint">
            The {layout ? w.many : countNumber === 1 || countNumber === null ? w.one : w.many} drawn {layout || (countNumber ?? 1) > 1 ? "stay" : "stays"} out of the {w.group} until you put {layout || (countNumber ?? 1) > 1 ? "them" : "it"} back, as with lots drawn and kept out. Everything written on {layout || (countNumber ?? 1) > 1 ? "them" : "it"} is kept.
          </span>
        </span>
      </label>
      {resting > 0 && <PutBack deckId={deckId} resting={resting} w={w} />}
      {hints && (
        <p className="text-xs text-ink-faint leading-relaxed">
          The app picks {w.many} from this {w.group} by chance, using the random method chosen in Settings: one {w.one}, or one for each position of a layout. {w.a.charAt(0).toUpperCase() + w.a.slice(1)} comes up at most once in a pull. The pull is
          saved, so you can come back to it.
        </p>
      )}
      <button
        type="submit"
        disabled={pulling || (!layout && countNumber === null)}
        className="bg-blush hover:bg-blush-soft disabled:opacity-40 text-canvas text-sm font-medium px-4 py-2 min-h-11 sm:min-h-0 rounded-lg transition-colors"
      >
        {pulling ? "Pulling…" : `Pull some ${w.many}`}
      </button>
      {error && <p className="text-xs text-danger" role="alert">{error}</p>}
    </form>
  );
}
