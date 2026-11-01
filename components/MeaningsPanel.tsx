"use client";

import { useCallback, useEffect, useState } from "react";
import { parseDate } from "@/lib/date";
import { fieldSmallClass } from "@/components/ui/Field";
import OwnLinks from "@/components/yours/OwnLinks";

type Side = "upright" | "reversed";

interface Fields {
  uprightKeywords: string | null;
  reversedKeywords: string | null;
  uprightDescription: string | null;
  reversedDescription: string | null;
}

interface CardInfo {
  personal: Fields | null;
  stock: Fields;
  revisionCount: number;
}

interface Revision extends Fields {
  id: number;
  created_at: string;
}

interface Props {
  cardId: string;
  /** Show only one side (the way the card was drawn). Leave out to show both. */
  orientation?: Side;
  /** Extra built-in material to show inside the Pixie-Smith section, such as the concept list. */
  children?: React.ReactNode;
  /** Another set of symbols (runes, for example) points the panel at its own meanings route. Tarot leaves this out. */
  api?: string;
  /** Where earlier versions are listed and deleted. Defaults to `/api/cards/<cardId>`, which works for any id. */
  revisionsApi?: string;
  /** The words on the button that opens the tradition's text. Defaults to "Pixie-Smith Meanings". */
  stockLabel?: string;
  /** The tradition's text for a set other than tarot. When given, it is shown in place of the Pixie-Smith fields. */
  stockSection?: React.ReactNode;
  /** What the symbol is called in "You have not written a meaning for this card yet." Defaults to "card". */
  noun?: string;
  /** Leave out the button and text of a tradition, for a set that has none (dice and coins). */
  hideStock?: boolean;
}

const EMPTY: Fields = { uprightKeywords: null, reversedKeywords: null, uprightDescription: null, reversedDescription: null };

const keywordsOf = (f: Fields, side: Side) => (side === "upright" ? f.uprightKeywords : f.reversedKeywords);
const descriptionOf = (f: Fields, side: Side) => (side === "upright" ? f.uprightDescription : f.reversedDescription);
const hasSide = (f: Fields | null, side: Side) => !!f && !!(keywordsOf(f, side) || descriptionOf(f, side));

function SideText({ fields, side, showLabel }: { fields: Fields; side: Side; showLabel: boolean }) {
  if (!hasSide(fields, side)) return null;
  return (
    <div className="space-y-1">
      {showLabel && (
        <p className={`text-[10px] uppercase tracking-widest ${side === "upright" ? "text-tone-400" : "text-danger"}`}>
          {side}
        </p>
      )}
      {keywordsOf(fields, side) && <p className="text-xs text-ink-muted leading-relaxed">{keywordsOf(fields, side)}</p>}
      {descriptionOf(fields, side) && (
        <p className="text-sm text-ink-soft leading-relaxed whitespace-pre-wrap">{descriptionOf(fields, side)}</p>
      )}
    </div>
  );
}

/**
 * A card's meanings: the user's own words first (editable, with every earlier version kept), and the
 * built-in text only after the user presses "Pixie-Smith Meanings".
 */
export default function MeaningsPanel({
  cardId, orientation, children, api: apiOverride, revisionsApi, stockLabel = "Pixie-Smith Meanings", stockSection, noun = "card", hideStock = false,
}: Props) {
  const sides: Side[] = orientation ? [orientation] : ["upright", "reversed"];
  const api = apiOverride ?? `/api/cards/${encodeURIComponent(cardId)}`;
  const revApi = revisionsApi ?? `/api/cards/${encodeURIComponent(cardId)}`;

  const [info, setInfo] = useState<CardInfo | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Fields>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [showStock, setShowStock] = useState(false);
  const [revisions, setRevisions] = useState<Revision[] | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(api);
    if (res.ok) setInfo(await res.json());
  }, [api]);

  const loadRevisions = useCallback(async () => {
    const res = await fetch(`${revApi}/revisions`);
    if (res.ok) setRevisions((await res.json()).revisions);
  }, [revApi]);

  useEffect(() => {
    setInfo(null);
    setEditing(false);
    setShowStock(false);
    setRevisions(null);
    setConfirmClear(false);
    load().catch(() => {});
  }, [load]);

  async function save(fields: Fields) {
    setSaving(true);
    setError(false);
    try {
      const res = await fetch(api, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!res.ok) throw new Error();
      setEditing(false);
      await load();
      if (revisions) await loadRevisions();
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  async function clearMeaning() {
    await fetch(api, { method: "DELETE" });
    setConfirmClear(false);
    await load();
  }

  async function deleteRevision(id: number) {
    await fetch(`${revApi}/revisions/${id}`, { method: "DELETE" });
    await Promise.all([load(), loadRevisions()]);
  }

  async function deleteAllHistory() {
    await Promise.all((revisions ?? []).map((r) => fetch(`${revApi}/revisions/${r.id}`, { method: "DELETE" })));
    await Promise.all([load(), loadRevisions()]);
  }

  if (!info) return <p className="text-xs text-ink-ghost animate-pulse">Loading…</p>;

  const personal = info.personal;
  const hasVisibleMeaning = sides.some((s) => hasSide(personal, s));
  const inputClass = fieldSmallClass;

  return (
    <div className="space-y-3">
      {/* The user's own meaning */}
      <section aria-label="Your meaning" className="bg-surface rounded-xl p-4 border border-line space-y-3">
        <p className="text-[10px] text-tone-300 uppercase tracking-widest">Your meaning</p>

        {editing ? (
          <div className="space-y-4">
            {sides.map((side) => {
              const k = side === "upright" ? "uprightKeywords" : "reversedKeywords";
              const d = side === "upright" ? "uprightDescription" : "reversedDescription";
              return (
                <div key={side} className="space-y-2">
                  {sides.length > 1 && (
                    <p className={`text-[10px] uppercase tracking-widest ${side === "upright" ? "text-tone-400" : "text-danger"}`}>{side}</p>
                  )}
                  <label className="block text-[10px] text-ink-faint uppercase tracking-wide">
                    A few words
                    <input
                      value={draft[k] ?? ""}
                      onChange={(e) => setDraft((prev) => ({ ...prev, [k]: e.target.value }))}
                      className={`${inputClass} mt-1 normal-case tracking-normal`}
                    />
                  </label>
                  <label className="block text-[10px] text-ink-faint uppercase tracking-wide">
                    In your own words
                    <textarea
                      value={draft[d] ?? ""}
                      onChange={(e) => setDraft((prev) => ({ ...prev, [d]: e.target.value }))}
                      rows={4}
                      className={`${inputClass} mt-1 normal-case tracking-normal resize-y leading-relaxed`}
                    />
                  </label>
                </div>
              );
            })}
            <div className="flex gap-2">
              <button
                onClick={() => save(draft)}
                disabled={saving}
                className="flex-1 text-xs bg-tone-700/60 hover:bg-tone-600/60 disabled:opacity-50 text-tone-100 font-medium py-2 px-3 rounded-lg transition-colors"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => { setEditing(false); setError(false); }}
                className="text-xs text-ink-faint hover:text-ink-soft py-2 px-3 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
            {error && <p className="text-xs text-danger">Could not save. Your text is still here; try again.</p>}
          </div>
        ) : (
          <>
            {hasVisibleMeaning ? (
              <div className="space-y-3">
                {sides.map((side) => (
                  <SideText key={side} fields={personal!} side={side} showLabel={sides.length > 1} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-faint italic">
                You have not written a meaning for this {noun}{orientation ? ` ${orientation}` : ""} yet.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <button
                onClick={() => { setDraft(personal ?? EMPTY); setEditing(true); setError(false); }}
                className="text-xs text-accent-ink hover:text-accent-ink-hover transition-colors"
              >
                {hasVisibleMeaning ? "Edit" : "Write your meaning"}
              </button>
              {info.revisionCount > 0 && (
                <button
                  onClick={() => (revisions ? setRevisions(null) : loadRevisions())}
                  aria-expanded={!!revisions}
                  className="text-xs text-ink-faint hover:text-ink-soft transition-colors"
                >
                  {revisions ? "Hide earlier versions" : `Earlier versions (${info.revisionCount})`}
                </button>
              )}
              {personal && !confirmClear && (
                <button onClick={() => setConfirmClear(true)} className="text-xs text-ink-ghost hover:text-danger-ink transition-colors">
                  Clear
                </button>
              )}
              {confirmClear && (
                <span className="text-xs text-ink-muted">
                  Clear your current meaning? Earlier versions are kept.{" "}
                  <button onClick={clearMeaning} className="text-danger-ink hover:text-danger-soft">Yes, clear</button>{" "}
                  <button onClick={() => setConfirmClear(false)} className="text-ink-faint hover:text-ink-soft">Cancel</button>
                </span>
              )}
            </div>
          </>
        )}

        {revisions && !editing && (
          <div className="border-t border-line pt-3 space-y-3">
            {revisions.length === 0 && <p className="text-xs text-ink-ghost">No earlier versions.</p>}
            {revisions.map((r) => (
              <div key={r.id} className="space-y-2 border-l-2 border-line-strong pl-3">
                <div className="flex items-center justify-between gap-3">
                  <time className="text-[10px] text-ink-faint" dateTime={parseDate(r.created_at).toISOString()}>
                    Saved {parseDate(r.created_at).toLocaleString()}
                  </time>
                  <span className="flex gap-3">
                    <button onClick={() => save(r)} disabled={saving} className="text-[10px] text-accent-ink hover:text-accent-ink-hover transition-colors">
                      Use this version
                    </button>
                    <button onClick={() => deleteRevision(r.id)} className="text-[10px] text-ink-ghost hover:text-danger-ink transition-colors">
                      Delete
                    </button>
                  </span>
                </div>
                {(["upright", "reversed"] as Side[]).map((side) => (
                  <SideText key={side} fields={r} side={side} showLabel />
                ))}
              </div>
            ))}
            {revisions.length > 1 && (
              <button onClick={deleteAllHistory} className="text-[10px] text-ink-ghost hover:text-danger-ink transition-colors">
                Delete all earlier versions
              </button>
            )}
          </div>
        )}
      </section>

      {/* The person's own archetypes and concepts for this piece: theirs, apart from the app's own matches below */}
      <OwnLinks symbolId={cardId} />

      {/* Built-in text, only on request */}
      {!hideStock && (
      <button
        onClick={() => setShowStock((v) => !v)}
        aria-expanded={showStock}
        className="w-full text-xs text-ink-muted hover:text-ink-strong border border-line hover:border-line-hover rounded-lg py-2 px-3 transition-colors"
      >
        {showStock ? "Hide " : ""}{stockLabel}
      </button>
      )}

      {!hideStock && showStock && (
        <section aria-label={stockLabel} className="bg-surface-sunken rounded-xl p-4 border border-line-faint space-y-3">
          {stockSection ?? sides.map((side) => (
            <SideText key={side} fields={info.stock} side={side} showLabel={sides.length > 1} />
          ))}
          {children}
        </section>
      )}
    </div>
  );
}
