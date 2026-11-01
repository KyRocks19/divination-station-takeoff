"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/ui/Button";
import { fieldFullClass } from "@/components/ui/Field";
import FormShape from "@/components/oracle/FormShape";
import { FORM_WORDS, SET_FORMS, formWords, type SetForm } from "@/lib/oracle-forms";

interface Props {
  deckId: number;
  name: string;
  description: string | null;
  /** Whether a pulled card can land upside down. */
  reversals: boolean;
  /** Out of 100 pulls, about how many land upside down. */
  reversalChance: number;
  /** What the set is made of. */
  form: SetForm;
  cardCount: number;
}

/** Radio choices for the form of a set: a small drawing and a name for each. */
function FormChoice({ name, value, onChange, legend }: { name: string; value: SetForm; onChange: (f: SetForm) => void; legend: string }) {
  return (
    <fieldset>
      <legend className="block text-xs text-ink-faint mb-1">{legend}</legend>
      <div className="grid grid-cols-2 gap-2">
        {SET_FORMS.map((f) => (
          <label
            key={f}
            className={`flex items-center gap-2 border rounded-control px-3 py-2 min-h-11 sm:min-h-0 cursor-pointer text-sm transition-colors ${
              value === f ? "border-focus text-ink-strong bg-surface-sunken" : "border-line-strong text-ink-muted hover:border-line-hover"
            }`}
          >
            <input type="radio" name={name} value={f} checked={value === f} onChange={() => onChange(f)} className="accent-tone-600" />
            <FormShape form={f} height={22} className="text-tone-500" />
            {FORM_WORDS[f].choice}
          </label>
        ))}
      </div>
    </fieldset>
  );
}


function send(url: string, method: string, body?: unknown) {
  return fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Rename or describe the set, change what it is made of, set whether items can land upside down, add another set, or delete this one. */
export default function DeckSettings({ deckId, name, description, reversals, reversalChance, form, cardCount }: Props) {
  const router = useRouter();
  const uid = useId();
  const [draftName, setDraftName] = useState(name);
  const [draftDescription, setDraftDescription] = useState(description ?? "");
  const [draftReversals, setDraftReversals] = useState(reversals);
  const [draftChance, setDraftChance] = useState(String(reversalChance));
  const [draftForm, setDraftForm] = useState<SetForm>(form);
  const [newForm, setNewForm] = useState<SetForm>("cards");
  const w = formWords(draftForm);
  const saved_w = formWords(form);

  const chance = Number(draftChance);
  const chanceValid = draftChance.trim() !== "" && Number.isInteger(chance) && chance >= 0 && chance <= 100;
  const [newDeckName, setNewDeckName] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function run(action: () => Promise<void>, failure: string) {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await action();
    } catch {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  function saveDeck(e: React.FormEvent) {
    e.preventDefault();
    if (!draftName.trim() || !chanceValid) return;
    run(async () => {
      const res = await send(`/api/oracle/decks/${deckId}`, "PATCH", {
        name: draftName,
        description: draftDescription,
        reversals: draftReversals,
        reversal_chance: chance,
        form: draftForm,
      });
      if (!res.ok) throw new Error();
      setSaved(true);
      router.refresh();
    }, "Could not save. Your text is still here; try again.");
  }

  function addDeck(e: React.FormEvent) {
    e.preventDefault();
    if (!newDeckName.trim()) return;
    run(async () => {
      const res = await send("/api/oracle/decks", "POST", { name: newDeckName, form: newForm });
      if (!res.ok) throw new Error();
      const deck = await res.json();
      setNewDeckName("");
      router.refresh();
      router.push(`/oracle?deck=${deck.id}`);
    }, `Could not add the ${formWords(newForm).group}. The name is still here; try again.`);
  }

  function deleteDeck() {
    run(async () => {
      const res = await send(`/api/oracle/decks/${deckId}`, "DELETE");
      if (!res.ok) throw new Error();
      router.push("/oracle");
    }, `Could not delete the ${saved_w.group}. Nothing was removed.`);
  }

  return (
    <details className="border-t border-line-faint pt-4">
      <summary className="text-sm text-ink-faint hover:text-ink-soft cursor-pointer transition-colors">
        {saved_w.Group} settings
      </summary>

      <div className="mt-4 space-y-6 max-w-xl">
        <form onSubmit={saveDeck} className="space-y-3">
          <div>
            <label htmlFor={`${uid}-name`} className="block text-xs text-ink-faint mb-1">{saved_w.Group} name</label>
            <input
              id={`${uid}-name`}
              value={draftName}
              onChange={(e) => { setDraftName(e.target.value); setSaved(false); }}
              autoComplete="off"
              className={fieldFullClass}
            />
          </div>
          <div>
            <label htmlFor={`${uid}-description`} className="block text-xs text-ink-faint mb-1">
              About this {saved_w.group} (optional)
            </label>
            <textarea
              id={`${uid}-description`}
              value={draftDescription}
              onChange={(e) => { setDraftDescription(e.target.value); setSaved(false); }}
              rows={2}
              className={`${fieldFullClass} resize-y leading-relaxed`}
            />
          </div>
          <FormChoice
            name={`${uid}-form`}
            value={draftForm}
            onChange={(f) => { setDraftForm(f); setSaved(false); }}
            legend="What this set is made of"
          />
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={draftReversals}
              onChange={(e) => { setDraftReversals(e.target.checked); setSaved(false); }}
              className="accent-tone-600 mt-1"
            />
            <span>
              <span className="text-sm text-ink-soft">{w.Many} can land upside down</span>
              <span className="block text-xs text-ink-faint mt-0.5">
                When this is on, a pulled {w.one} sometimes lands upside down, and you can mark a meaning as being for
                the upside-down {w.one}.
              </span>
            </span>
          </label>
          {draftReversals && (
            <div>
              <label htmlFor={`${uid}-chance`} className="block text-xs text-ink-faint mb-1">
                Out of 100 pulls, about how many land upside down
              </label>
              <input
                id={`${uid}-chance`}
                type="number"
                min={0}
                max={100}
                step={1}
                value={draftChance}
                onChange={(e) => { setDraftChance(e.target.value); setSaved(false); }}
                className={`${fieldFullClass} w-24`}
              />
              {!chanceValid && (
                <p role="alert" className="text-xs text-danger mt-1">Use a whole number from 0 to 100.</p>
              )}
            </div>
          )}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={busy || !draftName.trim() || !chanceValid} className={`${buttonClass.primary} whitespace-nowrap`}>
              Save
            </button>
            {saved && <span className="text-xs text-ink-faint" role="status">Saved.</span>}
          </div>
        </form>

        <form onSubmit={addDeck} className="space-y-2">
          <label htmlFor={`${uid}-new`} className="block text-xs text-ink-faint mb-1">Name for another set</label>
          <div className="flex gap-2">
            <input
              id={`${uid}-new`}
              value={newDeckName}
              onChange={(e) => setNewDeckName(e.target.value)}
              autoComplete="off"
              className={`${fieldFullClass} flex-1 min-w-0`}
            />
            <button
              type="submit"
              disabled={busy || !newDeckName.trim()}
              className="border border-line-strong hover:border-line-hover disabled:opacity-40 text-tone-300 text-sm font-medium px-4 py-2 min-h-11 sm:min-h-0 rounded-lg transition-colors whitespace-nowrap"
            >
              Add {formWords(newForm).group}
            </button>
          </div>
          <FormChoice name={`${uid}-newform`} value={newForm} onChange={setNewForm} legend="What the new set is made of" />
        </form>

        <div>
          {confirmDelete ? (
            <p className="text-xs text-ink-muted leading-relaxed">
              Delete &ldquo;{name}&rdquo;
              {cardCount > 0
                ? ` and its ${cardCount} ${cardCount !== 1 ? saved_w.many : saved_w.one}? Everything written on ${cardCount !== 1 ? "them" : "it"} is deleted too.`
                : "?"}{" "}
              Past pulls stay in your history with the names as they were. This cannot be undone.{" "}
              <button onClick={deleteDeck} disabled={busy} className="text-danger-ink hover:text-danger-soft">
                {busy ? "Deleting…" : "Yes, delete"}
              </button>{" "}
              <button onClick={() => setConfirmDelete(false)} className="text-ink-faint hover:text-ink-soft">
                Cancel
              </button>
            </p>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-ink-ghost hover:text-danger-ink transition-colors"
            >
              Delete this {saved_w.group}
            </button>
          )}
        </div>

        {error && <p className="text-xs text-danger" role="alert">{error}</p>}
      </div>
    </details>
  );
}
