"use client";

import { useEffect, useId, useRef, useState } from "react";
import AddToDay from "@/components/AddToDay";
import { useRouter } from "next/navigation";
import { parseDate, toISOString } from "@/lib/date";
import type { DivinationEntry } from "@/lib/divinations";
import { buttonClass } from "@/components/ui/Button";
import { fieldFullClass } from "@/components/ui/Field";
import { SectionLabel } from "@/components/ui/Page";
import { formWords, type SetForm } from "@/lib/oracle-forms";

/** Turns on "Make a card from this" for each entry. `deckId` is the deck the new card goes in (the first deck if empty). */
export interface CardMaker {
  deckId: number | null;
  /** The form of that deck, for the words ("Make a stone from this"). Cards when not given. */
  form?: SetForm;
}

interface Props {
  /** When given, each entry offers to start an oracle card from its words. */
  cardMaker?: CardMaker;
  /** The id of the reading's shared record (the `divinations` table). */
  divinationId: number;
  initialEntries: DivinationEntry[];
  /** What this kind of reading is called on its page, for example "pull". */
  noun: string;
  /** The words above the writing box. Left out, it says "Write about this pull" (with the noun). */
  prompt?: string;
  /** The short explanation under the box, for a tool where the usual one (about cards) does not fit. */
  hint?: string;
  /** Whether to show the short explanation (the person's "Explanations" setting). */
  hints: boolean;
  /** Change this number when an entry was added somewhere else on the page; the list then loads again. */
  reloadSignal?: number;
}

const inputClass = `${fieldFullClass} resize-y leading-relaxed`;

function send(url: string, method: string, body?: unknown) {
  return fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** One entry: the person's words, when they wrote them, and whether it is a look-back. */
function Entry({
  api,
  entry,
  onChanged,
  cardMaker,
}: {
  api: string;
  entry: DivinationEntry;
  onChanged: () => Promise<void>;
  cardMaker?: CardMaker;
}) {
  const editId = useId();
  const nameId = useId();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [makingCard, setMakingCard] = useState(false);
  const [cardName, setCardName] = useState("");
  const [draft, setDraft] = useState(entry.content);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(request: () => Promise<Response>, failure: string, after?: () => void) {
    setBusy(true);
    setError(null);
    try {
      const res = await request();
      if (!res.ok) throw new Error();
      await onChanged();
      after?.();
    } catch {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  // The entry's words become the new card's "where it comes from". The person names the card; nothing else is filled in.
  async function makeCard(e: React.FormEvent) {
    e.preventDefault();
    if (!cardName.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await send("/api/oracle/cards", "POST", {
        name: cardName,
        origin: entry.content,
        ...(cardMaker?.deckId ? { deck_id: cardMaker.deckId } : {}),
      });
      if (!res.ok) throw new Error();
      const card = await res.json();
      router.push(`/oracle/cards/${card.id}`);
    } catch {
      setError(`Could not make the ${formWords(cardMaker?.form).one}. Nothing was created; try again.`);
      setBusy(false);
    }
  }

  const lookback = entry.kind === "lookback";

  return (
    <li className={`border-l-2 pl-3 space-y-2 ${lookback ? "border-success/60" : "border-line-hover"}`}>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-ink-ghost">
        {lookback && <span className="text-success uppercase tracking-widest">Looking back</span>}
        {entry.kind === "impression" && (
          <span className="text-tone-300 uppercase tracking-widest">What you noticed first</span>
        )}
        {entry.thinking_mind === 1 && <span className="text-ink-faint uppercase tracking-widest">Thinking mind</span>}
        <time dateTime={toISOString(entry.created_at)} suppressHydrationWarning>
          {parseDate(entry.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
        </time>
      </p>

      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            act(
              () => send(`${api}/${entry.id}`, "PATCH", { content: draft }),
              "Could not save. Your text is still here; try again.",
              () => setEditing(false)
            );
          }}
          className="space-y-2"
        >
          <label htmlFor={editId} className="sr-only">Your entry</label>
          <textarea id={editId} value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} className={inputClass} />
          <div className="flex items-center gap-2">
            <button type="submit" disabled={busy || !draft.trim()} className={buttonClass.primary}>
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => { setDraft(entry.content); setEditing(false); setError(null); }}
              className={buttonClass.quiet}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="text-sm text-ink-strong leading-relaxed whitespace-pre-wrap break-words">{entry.content}</p>
          {makingCard ? (
            <form onSubmit={makeCard} className="space-y-2">
              <label htmlFor={nameId} className="block text-xs text-ink-faint">
                Name the new {formWords(cardMaker?.form).one}. These words will be saved on it as where it comes from.
              </label>
              <input
                id={nameId}
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                maxLength={200}
                autoFocus
                className={inputClass}
              />
              <div className="flex items-center gap-2">
                <button type="submit" disabled={busy || !cardName.trim()} className={buttonClass.primary}>
                  {busy ? "Making…" : `Make ${formWords(cardMaker?.form).one}`}
                </button>
                <button
                  type="button"
                  onClick={() => { setMakingCard(false); setCardName(""); setError(null); }}
                  className={buttonClass.quiet}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : confirmDelete ? (
            <p className="text-xs text-ink-muted">
              Delete this entry? This cannot be undone.{" "}
              <button
                onClick={() => act(() => send(`${api}/${entry.id}`, "DELETE"), "Could not delete. Nothing was removed.")}
                disabled={busy}
                className="text-danger-ink hover:text-danger-soft"
              >
                {busy ? "Deleting…" : "Yes, delete"}
              </button>{" "}
              <button onClick={() => setConfirmDelete(false)} className="text-ink-faint hover:text-ink-soft">
                Cancel
              </button>
            </p>
          ) : (
            <p className="flex gap-4">
              <button onClick={() => { setDraft(entry.content); setEditing(true); }} className={buttonClass.text}>Edit</button>
              {cardMaker && (
                <button onClick={() => setMakingCard(true)} className={buttonClass.text}>Make {formWords(cardMaker?.form).a} from this</button>
              )}
              <button
                onClick={() => act(() => send(`${api}/${entry.id}`, "PATCH", { thinking_mind: entry.thinking_mind !== 1 }), "Could not change that. Try again.")}
                disabled={busy}
                className={buttonClass.text}
              >
                {entry.thinking_mind === 1 ? "Not thinking mind" : "This was my thinking mind"}
              </button>
              <button onClick={() => setConfirmDelete(true)} className={buttonClass.danger}>Delete</button>
            </p>
          )}
        </>
      )}
      <div className="mt-1"><AddToDay kind="journal_entry" refId={entry.id} /></div>
      {error && <p className="text-xs text-danger" role="alert">{error}</p>}
    </li>
  );
}

/**
 * What a person has written about one reading, and a place to write more. Works for a reading of any kind,
 * because entries hang off the shared record. Every word here is the person's own.
 */
export default function DivinationJournal({
  divinationId,
  initialEntries,
  noun,
  prompt,
  hint,
  hints,
  reloadSignal = 0,
  cardMaker,
}: Props) {
  const api = `/api/divinations/${divinationId}/journals`;
  const uid = useId();
  const [entries, setEntries] = useState(initialEntries);
  const [content, setContent] = useState("");
  const [lookback, setLookback] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  async function reload() {
    const res = await fetch(api);
    if (res.ok) setEntries(await res.json());
  }

  // An entry saved by another part of the page (for example a first impression) shows up here too.
  const seenSignal = useRef(reloadSignal);
  useEffect(() => {
    if (seenSignal.current === reloadSignal) return;
    seenSignal.current = reloadSignal;
    fetch(api).then((res) => (res.ok ? res.json() : null)).then((list) => { if (list) setEntries(list); }).catch(() => {});
  }, [reloadSignal, api]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || saving) return;
    setSaving(true);
    setFailed(false);
    try {
      const res = await send(api, "POST", { content, kind: lookback ? "lookback" : "note", thinking_mind: thinking });
      if (!res.ok) throw new Error();
      setContent("");
      setLookback(false);
      setThinking(false);
      await reload();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby={`${uid}-heading`} className="space-y-4">
      <SectionLabel id={`${uid}-heading`}>
        Your writing{entries.length > 0 ? ` (${entries.length})` : ""}
      </SectionLabel>

      {entries.length > 0 && (
        <ol className="space-y-5 list-none p-0 m-0">
          {entries.map((entry) => (
            <Entry key={entry.id} api={api} entry={entry} onChanged={reload} cardMaker={cardMaker} />
          ))}
        </ol>
      )}

      <form onSubmit={add} className="bg-surface border border-line rounded-card p-4 space-y-3">
        <label htmlFor={`${uid}-content`} className="block text-xs text-ink-faint">
          {prompt ?? `Write about this ${noun}`}
        </label>
        <textarea
          id={`${uid}-content`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          className={inputClass}
        />
        <label className="flex items-start gap-2 text-xs text-ink-muted cursor-pointer">
          <input
            type="checkbox"
            checked={lookback}
            onChange={(e) => setLookback(e.target.checked)}
            className="accent-emerald-600 mt-0.5"
          />
          <span>I am looking back: this is about what happened afterwards</span>
        </label>
        <label className="flex items-start gap-2 text-xs text-ink-muted cursor-pointer">
          <input type="checkbox" checked={thinking} onChange={(e) => setThinking(e.target.checked)} className="accent-emerald-600 mt-0.5" />
          <span>This is my thinking mind (a guess, a memory, a story) rather than what I sensed</span>
        </label>
        {hints && (
          <p className="text-[11px] text-ink-ghost leading-relaxed">
            {hint ?? (
              <>
                You can come back to this {noun} later and write what happened. Reading your own words next to what
                followed is how your sense of your own cards sharpens.
              </>
            )}
          </p>
        )}
        <button type="submit" disabled={saving || !content.trim()} className={buttonClass.primary}>
          {saving ? "Saving…" : "Save entry"}
        </button>
        {failed && (
          <p className="text-xs text-danger" role="alert">Could not save. Your text is still here; try again.</p>
        )}
      </form>
    </section>
  );
}
