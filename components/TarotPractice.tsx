"use client";

import { useEffect, useId, useState } from "react";
import { parseDate } from "@/lib/date";
import {
  MAX_PRACTICE_WORDS, PRACTICE_SUITS, PRACTICE_SUIT_LABELS, chanceOf, type PracticeSuit, type PracticeSummary,
} from "@/lib/tarot-practice-core";
import FillImage from "@/components/ui/FillImage";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Field";
import { ErrorNote, SectionLabel } from "@/components/ui/Page";
import { SigilMark } from "@/components/ui/AppSigil";

interface ShownCard { id: string; name: string; fileName: string }
interface Trial { id: number; guess_suit: PracticeSuit | null; guess_words: string | null; created_at: string; card: ShownCard | null }

/**
 * Tarot practice: one card is drawn and sealed on the server; the person names the suit they sense (and may write words), and only then is the
 * card shown. Their record and the chance figure for the same guesses are below. Nothing here says what the numbers mean.
 */
export default function TarotPractice() {
  const uid = useId();
  const [sealed, setSealed] = useState<number | null>(null);
  const [suit, setSuit] = useState<PracticeSuit | null>(null);
  const [words, setWords] = useState("");
  const [shown, setShown] = useState<{ card: ShownCard; suit: PracticeSuit } | null>(null);
  const [record, setRecord] = useState<{ trials: Trial[]; summary: PracticeSummary } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  async function loadRecord() {
    const res = await fetch("/api/tarot-practice").catch(() => null);
    if (res?.ok) setRecord(await res.json());
    else setError((await res?.json().catch(() => null))?.error ?? "Your practice record could not be loaded.");
  }

  async function seal() {
    setBusy(true);
    setError(null);
    setShown(null);
    setSuit(null);
    setWords("");
    const res = await fetch("/api/tarot-practice", { method: "POST" }).catch(() => null);
    if (res?.ok) setSealed((await res.json()).id);
    else setError((await res?.json().catch(() => null))?.error ?? "A card could not be drawn. Try again.");
    setBusy(false);
  }

  async function guess() {
    if (sealed === null || !suit) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/tarot-practice/${sealed}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suit, words }),
    }).catch(() => null);
    if (res?.ok) {
      setShown({ card: (await res.json()).card, suit });
      setSealed(null);
      await loadRecord();
    } else {
      setError((await res?.json().catch(() => null))?.error ?? "Your guess could not be saved. Try again.");
    }
    setBusy(false);
  }

  async function clear() {
    setBusy(true);
    const res = await fetch("/api/tarot-practice", { method: "DELETE" }).catch(() => null);
    if (res?.ok) {
      setConfirmClear(false);
      setShown(null);
      await loadRecord();
    } else setError("Your record could not be deleted. Nothing changed.");
    setBusy(false);
  }

  useEffect(() => {
    void loadRecord();
  }, []);

  const right = shown ? shown.card.id.split("-")[0] === shown.suit : false;

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        {sealed === null ? (
          <div className="space-y-3">
            {shown && (
              <div className="flex gap-4 items-start" role="status">
                <div className="relative w-24 h-[168px] shrink-0 rounded-lg overflow-hidden border border-line">
                  <FillImage src={`/cards/${shown.card.fileName}`} alt={shown.card.name} className="object-cover" sizes="96px" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-ink-strong font-medium">The card was {shown.card.name}.</p>
                  <p className="text-sm text-ink-soft">
                    You sensed {PRACTICE_SUIT_LABELS[shown.suit]}: {right ? "the same group." : "a different group."}
                  </p>
                </div>
              </div>
            )}
            <p className="text-sm text-ink-muted">
              The app draws one card from the 78 and keeps it hidden. You say which suit you sense, and only then is it shown.
            </p>
            <Button onClick={seal} disabled={busy}>{shown ? "Draw another sealed card" : "Draw a sealed card"}</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="w-24 h-[168px] rounded-lg border-2 border-line bg-tone-900/30 flex items-center justify-center" aria-hidden="true">
              <SigilMark className="text-tone-400 text-4xl" />
            </div>
            <p className="text-sm text-ink-muted">A card is sealed. Take your time.</p>
            <fieldset className="space-y-1">
              <legend className="text-xs text-ink-faint mb-1">Which suit do you sense?</legend>
              {PRACTICE_SUITS.map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm text-ink-soft min-h-6">
                  <input type="radio" name={`${uid}-suit`} checked={suit === s} onChange={() => setSuit(s)} />
                  {PRACTICE_SUIT_LABELS[s]}
                </label>
              ))}
            </fieldset>
            <div>
              <label htmlFor={`${uid}-words`} className="block text-xs text-ink-faint mb-1">Anything else you sense (optional)</label>
              <Textarea id={`${uid}-words`} rows={2} maxLength={MAX_PRACTICE_WORDS} value={words} onChange={(e) => setWords(e.target.value)} />
            </div>
            <Button onClick={guess} disabled={busy || !suit}>{busy ? "Saving…" : "Seal my guess and show the card"}</Button>
          </div>
        )}
        {error && <ErrorNote role="alert">{error}</ErrorNote>}
      </Card>

      {record && record.summary.trials > 0 && (
        <section aria-labelledby={`${uid}-rec`} className="space-y-3">
          <SectionLabel id={`${uid}-rec`}>Your record</SectionLabel>
          <p className="text-sm text-ink-soft">
            {record.summary.trials} card{record.summary.trials === 1 ? "" : "s"}; you named the right group {record.summary.hits} time
            {record.summary.hits === 1 ? "" : "s"}. Guessing alone would name it about {record.summary.expected} times for the same guesses.
          </p>
          <p className="text-xs text-ink-ghost">
            The major arcana is 22 of the 78 cards (a {Math.round(chanceOf("major") * 100)}% chance) and each suit 14 ({Math.round(chanceOf("cups") * 100)}%).
            A few cards are too few to read much into. The app makes no claim either way about what a result means.
          </p>
          <ul className="space-y-2 list-none p-0">
            {record.trials.slice(0, 30).map((t) => (
              <li key={t.id} className="text-sm text-ink-soft border-l-2 border-line pl-3">
                <span className="text-xs text-ink-faint">{parseDate(t.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}: </span>
                {t.card?.name ?? "A card"}; you sensed {t.guess_suit ? PRACTICE_SUIT_LABELS[t.guess_suit] : "nothing"}
                {t.guess_words && <span className="block text-ink-muted whitespace-pre-wrap break-words">{t.guess_words}</span>}
              </li>
            ))}
          </ul>
          {confirmClear ? (
            <p className="text-xs text-ink-muted">
              Delete your whole practice record? This cannot be undone.{" "}
              <button type="button" className="text-danger-ink hover:text-danger-soft underline min-h-6" disabled={busy} onClick={clear}>Yes, delete it</button>{" "}
              <button type="button" className="text-ink-faint hover:text-ink-soft underline min-h-6" onClick={() => setConfirmClear(false)}>Cancel</button>
            </p>
          ) : (
            <button type="button" className={buttonClass.danger} onClick={() => setConfirmClear(true)}>Delete my practice record</button>
          )}
        </section>
      )}
    </div>
  );
}
