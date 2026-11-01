"use client";

import { useCallback, useEffect, useId, useState } from "react";
import AddToDay from "@/components/AddToDay";
import ReadingLetters from "@/components/ReadingLetters";
import { parseDate } from "@/lib/date";
import { OUTCOMES, OUTCOME_LABELS, type Outcome, type Prediction } from "@/lib/prediction-words";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/Field";
import { ErrorNote, SectionLabel } from "@/components/ui/Page";

interface Props {
  /** The reading's shared record (the `divinations` table). */
  divinationId?: number;
  /** For a tarot reading: its id in `readings`; the panel finds the shared record itself. */
  readingId?: number;
}

function send(url: string, method: string, body?: unknown) {
  return fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const today = () => new Date().toLocaleDateString("en-CA");
const day = (s: string) => parseDate(`${s}T12:00:00`).toLocaleDateString();

/** One prediction: the person's words, and what they decided afterwards. */
function Item({ prediction, onChanged }: { prediction: Prediction; onChanged: () => Promise<void> }) {
  const noteId = useId();
  const editId = useId();
  const dateId = useId();
  const [mode, setMode] = useState<"view" | "look" | "edit">("view");
  const [outcome, setOutcome] = useState<Outcome | null>(prediction.outcome);
  const [note, setNote] = useState(prediction.outcome_note ?? "");
  const [draft, setDraft] = useState(prediction.text);
  const [date, setDate] = useState(prediction.check_on ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const answered = prediction.outcome !== null;
  const due = !answered && prediction.check_on !== null && prediction.check_on <= today();
  const reworded = prediction.text !== prediction.original_text;

  async function act(request: () => Promise<Response>, failure: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await request();
      if (!res.ok) throw new Error();
      await onChanged();
      setMode("view");
      setConfirmDelete(false);
    } catch {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li>
      <Card pad="sm" className="space-y-2">
        {mode !== "edit" && <p className="text-sm text-ink-strong whitespace-pre-wrap break-words">{prediction.text}</p>}
        {mode === "edit" && (
          <div className="space-y-2">
            <label htmlFor={editId} className="sr-only">Your words</label>
            <Textarea id={editId} rows={3} maxLength={2000} value={draft} onChange={(e) => setDraft(e.target.value)} />
            <div>
              <label htmlFor={dateId} className="block text-xs text-ink-faint mb-1">Look back on (optional)</label>
              <Input id={dateId} type="date" wide={false} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="flex gap-3 items-center">
              <Button
                disabled={busy || !draft.trim()}
                onClick={() => act(() => send(`/api/predictions/${prediction.id}`, "PATCH", { text: draft, check_on: date || null }), "That could not be saved. Try again.")}
              >
                Save
              </Button>
              <Button variant="quiet" onClick={() => { setMode("view"); setDraft(prediction.text); setDate(prediction.check_on ?? ""); }}>Cancel</Button>
            </div>
          </div>
        )}

        <p className="text-xs text-ink-ghost">
          Written {parseDate(prediction.created_at).toLocaleDateString()}
          {prediction.check_on && !answered ? ` · look back on ${day(prediction.check_on)}` : ""}
          {due ? " · ready to look back on" : ""}
        </p>
        {reworded && (
          <details className="text-xs text-ink-ghost">
            <summary className="cursor-pointer">The first words, as written</summary>
            <p className="mt-1 whitespace-pre-wrap break-words text-ink-faint">{prediction.original_text}</p>
          </details>
        )}

        {answered && mode === "view" && (
          <div className="border-t border-line-faint pt-2 space-y-1">
            <p className="text-sm text-ink-soft">{OUTCOME_LABELS[prediction.outcome!]}</p>
            {prediction.outcome_note && <p className="text-sm text-ink-faint whitespace-pre-wrap break-words">{prediction.outcome_note}</p>}
          </div>
        )}

        {mode === "look" && (
          <div className="border-t border-line-faint pt-2 space-y-2">
            <fieldset className="space-y-1">
              <legend className="text-xs text-ink-faint mb-1">What happened? Only you can say.</legend>
              {OUTCOMES.map((o) => (
                <label key={o} className="flex items-center gap-2 text-sm text-ink-soft">
                  <input type="radio" name={`outcome-${prediction.id}`} checked={outcome === o} onChange={() => setOutcome(o)} />
                  {OUTCOME_LABELS[o]}
                </label>
              ))}
            </fieldset>
            <div>
              <label htmlFor={noteId} className="block text-xs text-ink-faint mb-1">In your own words (optional)</label>
              <Textarea id={noteId} rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="flex gap-3 items-center">
              <Button
                disabled={busy || outcome === null}
                onClick={() => act(() => send(`/api/predictions/${prediction.id}`, "PATCH", { outcome, outcome_note: note }), "That could not be saved. Try again.")}
              >
                Save
              </Button>
              <Button variant="quiet" onClick={() => { setMode("view"); setOutcome(prediction.outcome); setNote(prediction.outcome_note ?? ""); }}>Cancel</Button>
            </div>
          </div>
        )}

        {mode === "view" && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 items-center">
            {!answered && <button className={buttonClass.text} onClick={() => setMode("look")}>Look back on this</button>}
            {answered && (
              <>
                <button className={buttonClass.text} onClick={() => setMode("look")}>Change what I wrote</button>
                <button
                  className={buttonClass.text}
                  disabled={busy}
                  onClick={() => act(() => send(`/api/predictions/${prediction.id}`, "PATCH", { outcome: null }), "That could not be changed. Try again.")}
                >
                  Open it again
                </button>
              </>
            )}
            {!answered && <button className={buttonClass.text} onClick={() => setMode("edit")}>Reword or change the date</button>}
            {!confirmDelete ? (
              <button className={buttonClass.danger} onClick={() => setConfirmDelete(true)}>Delete</button>
            ) : (
              <span className="text-xs text-ink-faint flex items-center gap-2">
                Delete this prediction?
                <button className={buttonClass.danger} disabled={busy} onClick={() => act(() => send(`/api/predictions/${prediction.id}`, "DELETE"), "That could not be deleted. Try again.")}>Yes, delete</button>
                <button className={buttonClass.text} onClick={() => setConfirmDelete(false)}>Keep</button>
              </span>
            )}
          </div>
        )}
        <div className="mt-2"><AddToDay kind="prediction" refId={prediction.id} /></div>
        {error && <ErrorNote>{error}</ErrorNote>}
      </Card>
    </li>
  );
}

/**
 * The predictions already written under a reading, with what the person decided happened. A reading asks for one prediction only: the sealed
 * "write what you sense first" card (GuessFirst), with its look-back reminder below it (ReadingExtras). This panel used to ask a second time
 * ("What do you expect to happen?"), which the owner asked to remove on 2026-10-30, so it no longer takes new words. Ones written before stay
 * here, where they can still be reworded, looked back on or deleted. Nothing here scores or corrects anything.
 */
export default function PredictionsPanel({ divinationId, readingId }: Props) {
  const headingId = useId();
  const query = divinationId ? `divination_id=${divinationId}` : `reading_id=${readingId}`;
  const [items, setItems] = useState<Prediction[] | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/predictions?${query}`);
      if (res.ok) setItems(await res.json());
      else setItems([]);
    } catch {
      setItems([]);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
    {items && items.length > 0 && (
      <section aria-labelledby={headingId} className="space-y-3">
        <SectionLabel id={headingId}>What you expected</SectionLabel>
        <p className="text-xs text-ink-ghost">
          Your words are kept just as you wrote them. Afterwards you say what happened. Nobody else decides that.
        </p>
        <ul className="space-y-2">
          {items.map((p) => (
            <Item key={p.id} prediction={p} onChanged={load} />
          ))}
        </ul>
      </section>
    )}
    {/* Letters sent from this reading to someone in the circle, and what they wrote back (migration 103). */}
    <ReadingLetters divinationId={divinationId} readingId={readingId} />
    </>
  );
}
