"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DICE_OBJECTS, MAX_THROW, MAX_THROW_ITEMS, type DiceObjectId } from "@/lib/dice-data";
import LayoutPicker, { type LayoutChoice } from "@/components/LayoutPicker";
import { fieldClass } from "@/components/ui/Field";
import { buttonClass } from "@/components/ui/Button";

interface Props {
  /** Whether to show the short explanation (the person's "Explanations" setting). */
  hints: boolean;
  /** The person's own layouts. */
  layouts: LayoutChoice[];
}

/** One row of what to throw. The count is kept as text while typing, so a box can be emptied and retyped. */
interface Row {
  key: number;
  object: DiceObjectId;
  count: string;
}

const wholeNumber = (text: string) => {
  const n = Number(text);
  return text.trim() !== "" && Number.isInteger(n) && n >= 1 ? n : null;
};

/** Asks what to throw (one kind of object or several), how many of each, and an optional question and layout, then throws and opens the saved throw. */
export default function ThrowForm({ hints, layouts }: Props) {
  const router = useRouter();
  const uid = useId();
  const nextKey = useRef(1);
  const [question, setQuestion] = useState("");
  const [rows, setRows] = useState<Row[]>([{ key: 0, object: "d6", count: "1" }]);
  const [layout, setLayout] = useState<LayoutChoice | null>(null);
  const [throwing, setThrowing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const several = rows.length > 1;
  // With a layout, one is thrown for each position, so the number is not asked for.
  const counts = rows.map((r) => wholeNumber(r.count));
  const total = counts.reduce<number>((sum, n) => sum + (n ?? 0), 0);
  const rowsOk = counts.every((n) => n !== null && n <= MAX_THROW);
  const countsMessage = !rowsOk
    ? `Each count is a whole number from 1 to ${MAX_THROW}.`
    : total > MAX_THROW
      ? `Together they can be at most ${MAX_THROW}. Now there are ${total}.`
      : null;
  const countOk = layout !== null || countsMessage === null;

  function change(key: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function add() {
    setRows((rs) => [...rs, { key: nextKey.current++, object: "d6", count: "1" }]);
  }

  function remove(key: number) {
    setRows((rs) => rs.filter((r) => r.key !== key));
  }

  async function throwThem(e: React.FormEvent) {
    e.preventDefault();
    if (throwing || !countOk) return;
    setThrowing(true);
    setError(null);
    try {
      const res = await fetch("/api/dice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          ...(layout
            ? { object: rows[0].object, layoutId: layout.id }
            : { items: rows.map((r, i) => ({ object: r.object, count: counts[i] })) }),
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(typeof body?.error === "string" ? body.error : "");
      }
      const saved = await res.json();
      router.push(`/dice/${saved.id}`);
    } catch (err) {
      setError((err instanceof Error && err.message) || "Could not throw. Nothing was saved; your question is still here.");
      setThrowing(false);
    }
  }

  return (
    <form onSubmit={throwThem} className="bg-surface border border-line rounded-card p-5 space-y-4">
      <div>
        <label htmlFor={`${uid}-question`} className="block text-xs text-ink-faint mb-1">
          Your question or intention (optional)
        </label>
        <textarea
          id={`${uid}-question`}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={2}
          className={`w-full ${fieldClass} resize-y leading-relaxed`}
        />
      </div>

      <fieldset className="space-y-3">
        <legend className="text-xs text-ink-faint mb-1">What to throw</legend>
        <ul className="list-none p-0 space-y-3">
          {rows.map((r, i) => (
            <li key={r.key} className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-48">
                <label htmlFor={`${uid}-object-${r.key}`} className="block text-xs text-ink-faint mb-1">
                  {several ? `Object ${i + 1}` : "Object"}
                </label>
                <select
                  id={`${uid}-object-${r.key}`}
                  value={r.object}
                  onChange={(e) => change(r.key, { object: e.target.value as DiceObjectId })}
                  className={`w-full ${fieldClass}`}
                >
                  {DICE_OBJECTS.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>
              {!layout && (
                <div>
                  <label htmlFor={`${uid}-count-${r.key}`} className="block text-xs text-ink-faint mb-1">
                    {several ? `How many of object ${i + 1}` : `How many to throw (1 to ${MAX_THROW})`}
                  </label>
                  <input
                    id={`${uid}-count-${r.key}`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={MAX_THROW}
                    step={1}
                    value={r.count}
                    onChange={(e) => change(r.key, { count: e.target.value })}
                    aria-invalid={counts[i] === null || counts[i]! > MAX_THROW}
                    aria-describedby={countsMessage ? `${uid}-counts-message` : undefined}
                    className={`w-24 ${fieldClass}`}
                  />
                </div>
              )}
              {several && (
                <button
                  type="button"
                  onClick={() => remove(r.key)}
                  aria-label={`Remove object ${i + 1}`}
                  className={`${buttonClass.danger} sm:inline-flex sm:items-center sm:min-h-6`}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
        {!layout && countsMessage && (
          <p id={`${uid}-counts-message`} role="alert" className="text-xs text-danger">{countsMessage}</p>
        )}
        {rows.length < MAX_THROW_ITEMS && !layout && (
          <button type="button" onClick={add} className={`${buttonClass.text} sm:inline-flex sm:items-center sm:min-h-6`}>
            Add another object to this throw
          </button>
        )}
        {layout && (
          <p className="text-xs text-ink-faint">
            A layout goes with one kind of object. Choose “No layout” below to add more kinds.
          </p>
        )}
      </fieldset>

      {!several && (
        <LayoutPicker
          layouts={layouts}
          value={layout?.id ?? null}
          setSize={Number.MAX_SAFE_INTEGER}
          things="results"
          onChange={(l) => {
            setLayout(l);
            // The layout's own starting question fills an empty box; it never replaces what the person wrote.
            if (l?.question && !question.trim()) setQuestion(l.question);
          }}
        />
      )}

      {hints && (
        <p className="text-xs text-ink-faint leading-relaxed">
          The app picks each face by chance, using the random method chosen in Settings. Every throw is independent, so
          the same face can come up more than once. You can throw different kinds of object together, such as two dice
          and a coin. What a face means is up to you. The throw is saved, so you can come back to it.
        </p>
      )}

      <button type="submit" disabled={throwing || !countOk} className={buttonClass.primary}>
        {throwing ? "Throwing…" : "Throw some dice"}
      </button>
      {error && <p className="text-xs text-danger" role="alert">{error}</p>}
    </form>
  );
}
