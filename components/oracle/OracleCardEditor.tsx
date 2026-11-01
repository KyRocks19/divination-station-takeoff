"use client";

import { useEffect, useId, useRef, useState } from "react";
import ItemArt from "@/components/oracle/ItemArt";
import ArtEditor from "@/components/oracle/ArtEditor";
import ArtMaker from "@/components/oracle/ArtMaker";
import { formWords, type SetForm } from "@/lib/oracle-forms";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseDate, toISOString } from "@/lib/date";
import { usePrefs } from "@/components/usePrefs";
import QuestionPrompt from "@/components/oracle/QuestionPrompt";
import type { OracleCard, OracleCardPull, OracleFieldName, OracleMeaning } from "@/lib/oracle";
import { buttonClass } from "@/components/ui/Button";
import { fieldFullClass } from "@/components/ui/Field";
import { BackLink, SectionLabel } from "@/components/ui/Page";
import OwnLinks from "@/components/yours/OwnLinks";
import FieldNamesPanel from "@/components/oracle/FieldNamesPanel";

const SAVE_FAILED = "Could not save. Your text is still here; try again.";

function send(url: string, method: string, body?: unknown) {
  return fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const plural = (n: number, word: string) => `${n} ${word}${n !== 1 ? "s" : ""}`;

// The date is formatted in the reader's own locale, which the server cannot know.
// Earlier versions also show the time, because several can be written on one day.
function Written({ at, withTime }: { at: string; withTime?: boolean }) {
  const date = parseDate(at);
  return (
    <time className="text-[10px] text-ink-ghost" dateTime={toISOString(at)} suppressHydrationWarning>
      Written {withTime ? date.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }) : date.toLocaleDateString()}
    </time>
  );
}

function UpsideDown() {
  return (
    <span className="text-[10px] text-danger-soft border border-danger/40 rounded px-1.5 py-0.5 uppercase tracking-wide">
      Upside down
    </span>
  );
}

interface MeaningFormProps {
  initialLabel: string;
  initialContent: string;
  initialReversed: boolean;
  /** An existing meaning can be saved empty; a new one needs some words. */
  allowEmpty: boolean;
  /** Whether to offer "for the card upside down" (the deck has reversals on, or the meaning is already marked). */
  allowReversed: boolean;
  hints: boolean;
  /** Resolves to false when the save failed, so the text stays in the form. */
  onSave: (label: string, content: string, reversed: boolean) => Promise<boolean>;
  onCancel: () => void;
}

function MeaningForm({
  initialLabel, initialContent, initialReversed, allowEmpty, allowReversed, hints, onSave, onCancel,
}: MeaningFormProps) {
  const uid = useId();
  const [label, setLabel] = useState(initialLabel);
  const [content, setContent] = useState(initialContent);
  const [reversed, setReversed] = useState(initialReversed);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFailed(false);
    const ok = await onSave(label, content, reversed);
    if (!ok) setFailed(true);
    setSaving(false);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label htmlFor={`${uid}-content`} className="block text-xs text-ink-faint mb-1">In your own words</label>
        <textarea
          id={`${uid}-content`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          className={`${fieldFullClass} resize-y leading-relaxed`}
        />
      </div>
      <div>
        <label htmlFor={`${uid}-label`} className="block text-xs text-ink-faint mb-1">Label (optional)</label>
        <input
          id={`${uid}-label`}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          autoComplete="off"
          className={fieldFullClass}
        />
        {hints && (
          <p className="text-[11px] text-ink-ghost mt-1">A label can say whose meaning this is, or when it applies.</p>
        )}
      </div>
      {allowReversed && (
        <label className="flex items-center gap-2 text-xs text-ink-muted cursor-pointer">
          <input
            type="checkbox"
            checked={reversed}
            onChange={(e) => setReversed(e.target.checked)}
            className="accent-tone-600"
          />
          This meaning is for when the card lands upside down
        </label>
      )}
      <div className="flex items-center gap-2">
        <button type="submit" disabled={saving || (!allowEmpty && !content.trim())} className={buttonClass.primary}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onCancel} className={buttonClass.quiet}>Cancel</button>
      </div>
      {failed && <p className="text-xs text-danger" role="alert">{SAVE_FAILED}</p>}
    </form>
  );
}

interface MeaningItemProps {
  meaning: OracleMeaning;
  /** Whether the card's deck has reversals on. */
  deckReversals: boolean;
  hints: boolean;
  /** Reloads the card after this meaning changed. */
  onChanged: () => Promise<void>;
}

/** One meaning: the current text, with every earlier version kept underneath it. */
function MeaningItem({ meaning, deckReversals, hints, onChanged }: MeaningItemProps) {
  const api = `/api/oracle/meanings/${meaning.id}`;
  const [editing, setEditing] = useState(false);
  const [showEarlier, setShowEarlier] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(label: string, content: string, reversed: boolean): Promise<boolean> {
    try {
      const res = await send(api, "PATCH", { label, content, reversed });
      if (!res.ok) return false;
      await onChanged();
      setEditing(false);
      return true;
    } catch {
      return false;
    }
  }

  async function act(request: () => Promise<Response>, failure: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await request();
      if (!res.ok) throw new Error();
      await onChanged();
    } catch {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  const earlierCount = meaning.earlier.length;

  return (
    <article className="bg-surface border border-line rounded-xl p-4 space-y-3">
      {editing ? (
        <MeaningForm
          initialLabel={meaning.label ?? ""}
          initialContent={meaning.content}
          initialReversed={meaning.reversed === 1}
          allowEmpty
          allowReversed={deckReversals || meaning.reversed === 1}
          hints={hints}
          onSave={save}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          {(meaning.label || meaning.reversed === 1) && (
            <p className="flex flex-wrap items-center gap-2">
              {meaning.label && <span className="text-xs font-medium text-tone-300 break-words">{meaning.label}</span>}
              {meaning.reversed === 1 && <UpsideDown />}
            </p>
          )}
          {meaning.content ? (
            <p className="text-sm text-ink-strong leading-relaxed whitespace-pre-wrap break-words">{meaning.content}</p>
          ) : (
            <p className="text-sm text-ink-ghost italic">This meaning is empty.</p>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Written at={meaning.updated_at} />
            <button onClick={() => { setEditing(true); setConfirmDelete(false); }} className={buttonClass.text}>Edit</button>
            {earlierCount > 0 && (
              <button
                onClick={() => setShowEarlier((v) => !v)}
                aria-expanded={showEarlier}
                className="text-xs text-ink-faint hover:text-ink-soft transition-colors"
              >
                {showEarlier ? "Hide earlier versions" : `Earlier versions (${earlierCount})`}
              </button>
            )}
            {!confirmDelete && (
              <button onClick={() => setConfirmDelete(true)} className={buttonClass.danger}>Delete</button>
            )}
          </div>

          {confirmDelete && (
            <p className="text-xs text-ink-muted leading-relaxed">
              Delete this meaning{earlierCount > 0 ? ` and its ${plural(earlierCount, "earlier version")}` : ""}? This
              cannot be undone.{" "}
              <button
                onClick={() => act(() => send(api, "DELETE"), "Could not delete. Nothing was removed.")}
                disabled={busy}
                className="text-danger-ink hover:text-danger-soft"
              >
                Yes, delete
              </button>{" "}
              <button onClick={() => setConfirmDelete(false)} className="text-ink-faint hover:text-ink-soft">
                Cancel
              </button>
            </p>
          )}

          {showEarlier && earlierCount > 0 && (
            <div className="border-t border-line pt-3 space-y-3">
              {meaning.earlier.map((v) => (
                <div key={v.id} className="space-y-1 border-l-2 border-line-strong pl-3">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <Written at={v.created_at} withTime />
                    <span className="flex gap-3">
                      <button
                        onClick={() => act(
                          () => send(api, "PATCH", { label: v.label ?? "", content: v.content }),
                          "Could not bring that version back. Nothing was changed."
                        )}
                        disabled={busy}
                        className={`${buttonClass.text} text-[10px]`}
                      >
                        Use this version
                      </button>
                      <button
                        onClick={() => act(
                          () => send(`${api}/revisions/${v.id}`, "DELETE"),
                          "Could not delete. Nothing was removed."
                        )}
                        disabled={busy}
                        className={`${buttonClass.danger} text-[10px]`}
                      >
                        Delete
                      </button>
                    </span>
                  </div>
                  {v.label && <p className="text-xs font-medium text-tone-300/80 break-words">{v.label}</p>}
                  <p className="text-sm text-ink-muted leading-relaxed whitespace-pre-wrap break-words">{v.content}</p>
                </div>
              ))}
              {hints && (
                <p className="text-[11px] text-ink-ghost">
                  &ldquo;Use this version&rdquo; makes it the current text. The text it replaces is kept here.
                </p>
              )}
            </div>
          )}

          {error && <p className="text-xs text-danger" role="alert">{error}</p>}
        </>
      )}
    </article>
  );
}

interface FieldDraft {
  key: string;
  name: string;
  value: string;
  /** True for a field started from a name the person already uses: the cursor goes to its text box. */
  focusValue?: boolean;
}

/** Two field names are the same name when they differ only in capital letters or spaces around them. */
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

interface CardDraft {
  name: string;
  origin: string;
  fields: FieldDraft[];
}

const draftOf = (card: OracleCard): CardDraft => ({
  name: card.name,
  origin: card.origin ?? "",
  fields: card.fields.map((f) => ({ key: `saved-${f.id}`, name: f.name, value: f.value ?? "" })),
});

/**
 * One oracle card: its name, where it comes from, the person's own named fields, and their meanings.
 * Every word on the page is the person's own; nothing is filled in for them.
 */
/**
 * The times this item came up in a pull, newest first, each linking to that pull. Only facts: when, the question the
 * person asked, whether it landed upside down, and how many entries they wrote. Nothing is counted for or against it.
 */
function TimesCameUp({ pulls, more, one }: { pulls: OracleCardPull[]; more: boolean; one: string }) {
  const uid = useId();
  return (
    <section aria-labelledby={`${uid}-pulls`} className="space-y-3">
      <SectionLabel id={`${uid}-pulls`}>
        Times this {one} came up{pulls.length > 0 ? ` (${more ? `${pulls.length}+` : pulls.length})` : ""}
      </SectionLabel>
      {pulls.length === 0 ? (
        <p className="text-sm text-ink-ghost">This {one} has not come up in a pull yet.</p>
      ) : (
        <>
          <ul className="space-y-2 list-none p-0 m-0">
            {pulls.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/oracle/pulls/${p.id}`}
                  className="block bg-surface border border-line hover:border-line-hover rounded-card px-4 py-3 min-h-11 transition-colors"
                >
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <time className="text-xs text-ink-faint" dateTime={toISOString(p.created_at)} suppressHydrationWarning>
                      {parseDate(p.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                    </time>
                    {p.reversed === 1 && <UpsideDown />}
                    {p.entries.length > 0 && (
                      <span className="text-xs text-tone-500">
                        {p.entries.length} {p.entries.length === 1 ? "entry" : "entries"} written
                      </span>
                    )}
                  </span>
                  {p.question && (
                    <span className="block text-sm text-ink-soft mt-1 line-clamp-2 break-words">{p.question}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
          {more && <p className="text-xs text-ink-ghost">Only the latest {pulls.length} are listed. Earlier ones are under Past pulls.</p>}
        </>
      )}
    </section>
  );
}

/** One of the person's sets, for choosing where to move an item. */
export interface SetChoice {
  id: number;
  name: string;
  form: SetForm;
}

/**
 * Moves the item to another of the person's sets. Everything written on it, its picture and the pulls it came up in
 * go with it. If the other set is made of something else, only the words change (a card becomes a stone), so that is
 * said before the move.
 */
function MoveToSet({ card, sets, onMoved }: { card: OracleCard; sets: SetChoice[]; onMoved: () => Promise<void> }) {
  const uid = useId();
  const others = sets.filter((s) => s.id !== card.deck_id);
  const [targetId, setTargetId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const target = others.find((s) => s.id === targetId) ?? null;
  const now = formWords(card.deck_form);

  if (others.length === 0) return null;

  async function move() {
    if (!target || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await send(`/api/oracle/cards/${card.id}`, "PATCH", { deck_id: target.id });
      if (!res.ok) throw new Error();
      setDone(`Moved to “${target.name}”.`);
      setTargetId(null);
      await onMoved();
    } catch {
      setError("Could not move it. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-ink-faint">Move this {now.one} to another set</p>
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <label htmlFor={`${uid}-set`} className="sr-only">Set to move this {now.one} to</label>
        <select
          id={`${uid}-set`}
          value={targetId ?? ""}
          onChange={(e) => { setTargetId(e.target.value ? Number(e.target.value) : null); setDone(null); setError(null); }}
          className={`${fieldFullClass} sm:w-72`}
        >
          <option value="">Choose a set…</option>
          {others.map((s) => (
            <option key={s.id} value={s.id}>{s.name} ({formWords(s.form).group})</option>
          ))}
        </select>
      </div>
      {target && (
        <p className="text-xs text-ink-muted leading-relaxed">
          Move &ldquo;{card.name}&rdquo; to &ldquo;{target.name}&rdquo;? It goes to the end of that {formWords(target.form).group}, with everything
          written on it, its picture and the pulls it came up in.
          {target.form !== card.deck_form && (
            <> That {formWords(target.form).group} is made of {formWords(target.form).many}, so it will be called {formWords(target.form).a} there. Only the word changes.</>
          )}{" "}
          <button onClick={move} disabled={busy} className="text-danger-ink hover:text-danger-soft">
            {busy ? "Moving…" : "Yes, move it"}
          </button>{" "}
          <button onClick={() => setTargetId(null)} className="text-ink-faint hover:text-ink-soft">Cancel</button>
        </p>
      )}
      {done && <p className="text-xs text-ink-faint" role="status">{done}</p>}
      {error && <p className="text-xs text-danger" role="alert">{error}</p>}
    </div>
  );
}

interface Props {
  initialCard: OracleCard;
  /** All of the person's sets, so an item can be moved to another. */
  sets: SetChoice[];
  /** The latest times this item came up in a pull, newest first. */
  pulls: OracleCardPull[];
  /** True when there are earlier pulls than the ones listed. */
  morePulls: boolean;
  /** Whether a card with no words yet shows a question that may help (the person's Settings choice). */
  showQuestions: boolean;
  /** The field names the person has used on their cards, so a name typed once can be used again. */
  fieldNames: OracleFieldName[];
  /** Whether to offer making pictures (the person's Settings choice). */
  artHelp: boolean;
  /** Whether the app has an image tool address set up (the IMAGE_GEN_URL setting). */
  imageToolReady: boolean;
  /** "queue": pictures wait for the owner's computer; "direct": this server asks the image tool itself. */
  imageMode: "direct" | "queue";
  /** Whether pictures are kept as files on disk (ART_DIR), which allows larger pictures. */
  artOnDisk: boolean;
}

export default function OracleCardEditor({ initialCard, sets, pulls, morePulls, showQuestions, fieldNames, artHelp, imageToolReady, imageMode, artOnDisk }: Props) {
  const router = useRouter();
  const uid = useId();
  const hints = usePrefs().scaffolding === "more";
  const api = `/api/oracle/cards/${initialCard.id}`;
  const [card, setCard] = useState(initialCard);
  // The words follow the set the item is in now: moving it to a bag makes it a stone.
  const w = formWords(card.deck_form);

  // A card with nothing on it opens ready to write on.
  const [editing, setEditing] = useState(
    !initialCard.origin && initialCard.fields.length === 0 && initialCard.meanings.length === 0
  );
  const [draft, setDraft] = useState<CardDraft>(() => draftOf(initialCard));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingMeaning, setAddingMeaning] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const [restError, setRestError] = useState(false);
  const newFieldCount = useRef(0);
  const [knownFields, setKnownFields] = useState(fieldNames);

  async function reload() {
    const res = await fetch(api);
    if (res.ok) setCard(await res.json());
  }

  function updateField(key: string, change: Partial<FieldDraft>) {
    setDraft((d) => ({ ...d, fields: d.fields.map((f) => (f.key === key ? { ...f, ...change } : f)) }));
  }

  // The names and counts change whenever a card is saved, here or in another tab, so they are read again before they
  // are shown in a question about every card. Returns the fresh list, or null when it could not be read.
  async function refreshKnownFields(): Promise<OracleFieldName[] | null> {
    try {
      const res = await fetch("/api/oracle/fields");
      if (!res.ok) return null;
      const list: OracleFieldName[] = await res.json();
      setKnownFields(list);
      return list;
    } catch {
      return null;
    }
  }

  // A field name was removed from every item. The card on screen follows: its saved fields and any rows being edited
  // lose that name too, and other unsaved edits stay.
  function fieldNameRemoved(name: string) {
    setCard((c) => ({ ...c, fields: c.fields.filter((f) => !sameName(f.name, name)) }));
    setDraft((d) => ({ ...d, fields: d.fields.filter((f) => !sameName(f.name, name)) }));
  }

  // A field name was changed on every item. This card's saved fields and the rows being edited take the new name.
  function fieldNameRenamed(from: string, to: string) {
    const rename = <T extends { name: string }>(f: T): T => (sameName(f.name, from) ? { ...f, name: to } : f);
    setCard((c) => ({ ...c, fields: c.fields.map(rename) }));
    setDraft((d) => ({ ...d, fields: d.fields.map(rename) }));
  }

  // Names the person already uses that this card does not hold yet (counting what is being typed now).
  const unusedNames = knownFields.filter((k) => !draft.fields.some((f) => sameName(f.name, k.name)));

  async function saveCard(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) return;
    if (draft.fields.some((f) => !f.name.trim() && f.value.trim())) {
      setError("A field with text in it needs a name. Name it, or clear its text.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await send(api, "PATCH", {
        name: draft.name,
        origin: draft.origin,
        fields: draft.fields.map(({ name, value }) => ({ name, value })),
      });
      if (!res.ok) throw new Error();
      const saved: OracleCard = await res.json();
      setCard(saved);
      setDraft(draftOf(saved));
      setEditing(false);
      refreshKnownFields();
    } catch {
      setError(SAVE_FAILED);
    } finally {
      setSaving(false);
    }
  }

  async function addMeaning(label: string, content: string, reversed: boolean): Promise<boolean> {
    try {
      const res = await send(`${api}/meanings`, "POST", { label, content, reversed });
      if (!res.ok) return false;
      await reload();
      setAddingMeaning(false);
      return true;
    } catch {
      return false;
    }
  }

  // A resting card stays in the deck with everything written on it, and is left out of pulls.
  async function setResting(resting: boolean) {
    setSaving(true);
    setRestError(false);
    try {
      const res = await send(api, "PATCH", { resting });
      if (!res.ok) throw new Error();
      setCard(await res.json());
    } catch {
      setRestError(true);
    } finally {
      setSaving(false);
    }
  }

  async function deleteCard() {
    setSaving(true);
    setDeleteError(false);
    try {
      const res = await send(api, "DELETE");
      if (!res.ok) throw new Error();
      router.push(`/oracle?deck=${card.deck_id}`);
    } catch {
      setDeleteError(true);
      setSaving(false);
    }
  }

  return (
    <div className="max-w-page mx-auto px-4 pt-8 pb-16 space-y-8">
      <BackLink href={`/oracle?deck=${card.deck_id}`}>
        ← {card.deck_name}
      </BackLink>

      <div className="space-y-2">
        <div className="flex items-center gap-4">
          <ItemArt cardId={card.id} version={card.art?.version} alt={card.art?.alt} form={card.deck_form} height={72} />
          <h1 className="text-3xl font-bold text-tone-100 break-words min-w-0">{card.name}</h1>
        </div>
        {card.resting === 1 && (
          <p className="text-xs text-ink-muted">
            <span className="uppercase tracking-wide border border-line-strong rounded px-1.5 py-0.5 mr-2">Resting</span>
            This {w.one} is not pulled until you wake it.
          </p>
        )}
      </div>

      {showQuestions && !card.origin && card.fields.length === 0 && card.meanings.length === 0 && (
        <QuestionPrompt set="writing" />
      )}

      <ArtEditor cardId={card.id} form={card.deck_form} art={card.art} onDisk={artOnDisk} onChanged={reload} />
      {artHelp && (
        <ArtMaker
          key={card.id}
          cardId={card.id}
          deckId={card.deck_id}
          form={card.deck_form}
          card={card}
          hasArt={!!card.art}
          imageToolReady={imageToolReady}
          imageMode={imageMode}
          onDisk={artOnDisk}
          onChanged={reload}
        />
      )}

      <section
        aria-labelledby={`${uid}-about`}
        className="bg-surface border border-line rounded-card p-5 space-y-4"
      >
        {editing ? (
          <form onSubmit={saveCard} className="space-y-4">
            <SectionLabel id={`${uid}-about`}>About this {w.one}</SectionLabel>

            <div>
              <label htmlFor={`${uid}-name`} className="block text-xs text-ink-faint mb-1">{w.One} name</label>
              <input
                id={`${uid}-name`}
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                autoComplete="off"
                className={fieldFullClass}
              />
            </div>

            <div>
              <label htmlFor={`${uid}-origin`} className="block text-xs text-ink-faint mb-1">
                Where it comes from (optional)
              </label>
              <textarea
                id={`${uid}-origin`}
                value={draft.origin}
                onChange={(e) => setDraft((d) => ({ ...d, origin: e.target.value }))}
                rows={4}
                className={`${fieldFullClass} resize-y leading-relaxed`}
              />
              {hints && (
                <p className="text-[11px] text-ink-ghost mt-1">
                  A memory, a person, a place, a feeling, a saying. It can stay empty.
                </p>
              )}
            </div>

            <fieldset className="space-y-2 border-0 p-0 m-0">
              <legend className="text-xs text-ink-faint mb-1">Your own fields (optional)</legend>
              {hints && (
                <p className="text-[11px] text-ink-ghost">
                  A field is anything else you want this card to hold. You name it yourself, for example: song,
                  season, colour.
                </p>
              )}
              {draft.fields.map((f, i) => (
                <div key={f.key} className="flex flex-col sm:flex-row gap-2" role="group" aria-label={`Field ${i + 1}`}>
                  <label htmlFor={`${uid}-field-name-${f.key}`} className="sr-only">Field {i + 1} name</label>
                  <input
                    id={`${uid}-field-name-${f.key}`}
                    value={f.name}
                    onChange={(e) => updateField(f.key, { name: e.target.value })}
                    placeholder="Field name"
                    autoComplete="off"
                    className={`${fieldFullClass} sm:w-1/3`}
                  />
                  <label htmlFor={`${uid}-field-value-${f.key}`} className="sr-only">Field {i + 1} text</label>
                  <input
                    id={`${uid}-field-value-${f.key}`}
                    value={f.value}
                    onChange={(e) => updateField(f.key, { value: e.target.value })}
                    placeholder="What it holds"
                    autoComplete="off"
                    autoFocus={f.focusValue}
                    className={`${fieldFullClass} sm:flex-1`}
                  />
                  <button
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, fields: d.fields.filter((x) => x.key !== f.key) }))}
                    aria-label={`Remove field ${i + 1}`}
                    className="text-danger px-2 self-start sm:self-center"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setDraft((d) => ({
                  ...d,
                  fields: [...d.fields, { key: `new-${newFieldCount.current++}`, name: "", value: "" }],
                }))}
                className="text-sm text-tone-400 hover:text-tone-300 min-h-6"
              >
                + Add a field
              </button>

              {unusedNames.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <p id={`${uid}-known`} className="text-[11px] text-ink-faint">Use a field name you already have:</p>
                  <ul aria-labelledby={`${uid}-known`} className="flex flex-wrap gap-2 list-none p-0 m-0">
                    {unusedNames.map((k) => (
                      <li key={k.name}>
                        <button
                          type="button"
                          onClick={() => setDraft((d) => ({
                            ...d,
                            fields: [...d.fields, { key: `known-${newFieldCount.current++}`, name: k.name, value: "", focusValue: true }],
                          }))}
                          className="text-xs text-tone-300 border border-line-strong hover:border-line-hover rounded-full px-3 py-1 break-words"
                        >
                          {k.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {knownFields.length > 0 && (
                <details className="pt-1">
                  <summary className="text-[11px] text-ink-faint hover:text-ink-soft cursor-pointer">
                    Field names on your items ({knownFields.length})
                  </summary>
                  <div className="mt-2">
                    <FieldNamesPanel
                      names={knownFields}
                      refresh={refreshKnownFields}
                      onRemoved={fieldNameRemoved}
                      onRenamed={fieldNameRenamed}
                    />
                  </div>
                </details>
              )}
            </fieldset>

            <div className="flex items-center gap-2">
              <button type="submit" disabled={saving || !draft.name.trim()} className={buttonClass.primary}>
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => { setDraft(draftOf(card)); setEditing(false); setError(null); }}
                className={buttonClass.quiet}
              >
                Cancel
              </button>
            </div>
            {error && <p className="text-xs text-danger" role="alert">{error}</p>}
          </form>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <SectionLabel id={`${uid}-about`}>
                Where it comes from
              </SectionLabel>
              <button onClick={() => { setDraft(draftOf(card)); setEditing(true); }} className={buttonClass.text}>
                Edit
              </button>
            </div>
            {card.origin ? (
              <p className="text-sm text-ink-strong leading-relaxed whitespace-pre-wrap break-words">{card.origin}</p>
            ) : (
              <p className="text-sm text-ink-ghost italic">Nothing written here.</p>
            )}
            {card.fields.length > 0 && (
              <dl className="space-y-3 pt-1">
                {card.fields.map((f) => (
                  <div key={f.id}>
                    <dt className="text-xs font-medium text-tone-300 break-words">{f.name}</dt>
                    <dd className="text-sm text-ink-strong leading-relaxed whitespace-pre-wrap break-words m-0">{f.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </>
        )}
      </section>

      <section aria-labelledby={`${uid}-meanings`} className="space-y-3">
        <SectionLabel id={`${uid}-meanings`}>Meanings</SectionLabel>
        {hints && (
          <p className="text-xs text-ink-faint leading-relaxed">
            What this card means, in your own words. A card can hold several meanings side by side. When you change
            a meaning, the earlier text is kept under it.
          </p>
        )}

        {card.meanings.map((m) => (
          <MeaningItem
            key={m.id}
            meaning={m}
            deckReversals={card.deck_reversals === 1}
            hints={hints}
            onChanged={reload}
          />
        ))}

        {addingMeaning ? (
          <div className="bg-surface border border-line rounded-xl p-4">
            <MeaningForm
              initialLabel=""
              initialContent=""
              initialReversed={false}
              allowEmpty={false}
              allowReversed={card.deck_reversals === 1}
              hints={hints}
              onSave={addMeaning}
              onCancel={() => setAddingMeaning(false)}
            />
          </div>
        ) : (
          <button
            onClick={() => setAddingMeaning(true)}
            className="w-full text-sm text-tone-300 border border-line hover:border-line-hover rounded-lg py-2 px-3 transition-colors"
          >
            {card.meanings.length > 0 ? "+ Add another meaning" : "+ Write a meaning"}
          </button>
        )}
      </section>

      <TimesCameUp pulls={pulls} more={morePulls} one={w.one} />

      <OwnLinks oracleCardId={card.id} />

      <div className="border-t border-line-faint pt-4 space-y-4">
        <div className="space-y-1">
          <button onClick={() => setResting(card.resting !== 1)} disabled={saving} className={buttonClass.text}>
            {card.resting === 1 ? `Wake this ${w.one}` : `Rest this ${w.one}`}
          </button>
          <p className="text-xs text-ink-ghost leading-relaxed">
            A resting card stays in the deck with everything written on it. It is not pulled until you wake it.
          </p>
          {restError && <p className="text-xs text-danger" role="alert">Could not change that. Nothing was changed.</p>}
        </div>

        <MoveToSet card={card} sets={sets} onMoved={reload} />

        {confirmDelete ? (
          <p className="text-xs text-ink-muted leading-relaxed">
            Delete &ldquo;{card.name}&rdquo; and everything written on it? Past pulls keep the {w.one}&rsquo;s name.
            This cannot be undone.{" "}
            <button onClick={deleteCard} disabled={saving} className="text-danger-ink hover:text-danger-soft">
              {saving ? "Deleting…" : "Yes, delete"}
            </button>{" "}
            <button onClick={() => setConfirmDelete(false)} className="text-ink-faint hover:text-ink-soft">
              Cancel
            </button>
          </p>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className={buttonClass.danger}>Delete this {w.one}</button>
        )}
        {deleteError && (
          <p className="text-xs text-danger mt-2" role="alert">Could not delete the {w.one}. Nothing was removed.</p>
        )}
      </div>
    </div>
  );
}
