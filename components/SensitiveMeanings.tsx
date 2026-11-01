"use client";

import { useEffect, useId, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { usePrefs } from "@/components/usePrefs";

/** Saves the choice. Null when saved, otherwise the words to show (turning it on needs "I am 18 or older" in Settings). */
async function save(show: boolean): Promise<string | null> {
  try {
    const res = await fetch("/api/sensitive-meanings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ show }),
    });
    if (res.ok) return null;
    const body = await res.json().catch(() => null);
    return body?.code === "needs_adult" ? "Sensitive meanings are for adults. Confirm your age in Settings, under Age, to see them." : "That could not be saved. Try again.";
  } catch {
    return "That could not be saved. Try again.";
  }
}

/**
 * The button on a page that lists concepts: shows or hides the words that name abuse, sexual content or violence. It saves the choice on
 * the account (the same one the Settings page changes) and then asks the page to read its concepts again.
 */
export function SensitiveMeaningsToggle({ showing, count, onChanged }: { showing: boolean; count: number; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  if (count === 0) return null;

  async function toggle() {
    setBusy(true);
    setFailed(null);
    const error = await save(!showing);
    setBusy(false);
    if (error === null) onChanged();
    else setFailed(error);
  }

  return (
    <div className="space-y-1">
      {!showing && (
        <p className="text-xs text-ink-faint">
          {count === 1 ? "One word linked here names" : `${count} words linked here name`} abuse, sexual content or violence. They are hidden until you choose to see them.
        </p>
      )}
      <Button type="button" variant="text" onClick={toggle} disabled={busy} aria-pressed={showing} className="min-h-6">
        {showing ? "Hide sensitive meanings" : `Show sensitive meanings (${count})`}
      </Button>
      {failed && <p role="status" className="text-xs text-danger">{failed}</p>}
    </div>
  );
}

/** The note under a list of concepts: they are words people linked to a card, not predictions, and not advice. */
export function ConceptNote() {
  return (
    <p className="text-xs text-ink-faint">
      These are words people have linked to this card. They are not predictions or verdicts about anyone, and nothing here is medical, legal or financial advice.
    </p>
  );
}

/** The button at the top of a page that lists many concepts (the Encyclopedia): it reads the choice and the number of sensitive concepts itself. */
export function SensitiveMeaningsBar({ onChanged }: { onChanged: () => void }) {
  const [state, setState] = useState<{ show: boolean; count: number }>({ show: false, count: 0 });
  function load() {
    fetch("/api/sensitive-meanings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setState({ show: d.show === true, count: Number(d.count) || 0 }); })
      .catch(() => {});
  }
  useEffect(load, []);
  return (
    <SensitiveMeaningsToggle
      showing={state.show}
      count={state.count}
      onChanged={() => {
        load();
        onChanged();
      }}
    />
  );
}

/** The same choice as a setting, with the explanation. */
export function SensitiveMeaningsSetting() {
  const uid = useId();
  const [show, setShow] = useState(false);
  const [note, setNote] = useState("");
  const prefs = usePrefs();

  useEffect(() => {
    fetch("/api/sensitive-meanings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setShow(d.show === true); })
      .catch(() => {});
  }, []);

  async function change(next: boolean) {
    // The box changes at once; it goes back if the choice could not be saved.
    setNote("");
    setShow(next);
    const error = await save(next);
    if (error === null) {
      setNote(next ? "Sensitive meanings are shown." : "Sensitive meanings are hidden.");
    } else {
      setShow(!next);
      setNote(error);
    }
  }

  return (
    <Card className="space-y-3" role="group" aria-labelledby={`${uid}-h`}>
      <h3 id={`${uid}-h`} className="font-semibold text-ink-strong">Sensitive meanings</h3>
      <p className="text-sm text-ink-muted">
        Some of the words linked to tarot cards name abuse, sexual content or violence. They are hidden unless you turn this on. When it is on, they are shown on card pages, in the Encyclopedia and in search. The choice is saved in your account.
      </p>
      <label className="flex items-center gap-3 min-h-11 text-sm text-ink cursor-pointer">
        <input type="checkbox" checked={show && prefs.adultConfirmed} disabled={!prefs.adultConfirmed && !show} onChange={(e) => change(e.target.checked)} className="accent-[var(--color-focus)]" />
        Show sensitive meanings
      </label>
      {!prefs.adultConfirmed && <p className="text-xs text-ink-faint">For adults only: confirm your age under Age, above, first.</p>}
      <p role="status" className="text-xs text-ink-faint min-h-4">{note}</p>
    </Card>
  );
}
