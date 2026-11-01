"use client";

import { useEffect, useId, useState } from "react";
import { parseDate, toISOString } from "@/lib/date";
import { MAX_GROUP_NOTE_LENGTH } from "@/lib/card-groups";
import { buttonClass } from "@/components/ui/Button";
import { fieldFullClass } from "@/components/ui/Field";

interface Earlier {
  id: number;
  content: string;
  created_at: string;
}

interface Props {
  /** The id the words are kept under ('group-suit-cups'). */
  groupId: string;
  /** What it covers, plural: "Cups", "Fives". */
  label: string;
  /** Whether to show the short explanation (the person's "Explanations" setting). */
  hints: boolean;
}

/**
 * The person's own words for a whole suit or a whole number ("what Fives mean to me"). Nothing is written for them: an
 * empty note stays empty. Every change keeps the wording it replaced, which they can read or delete.
 */
export default function GroupNote({ groupId, label, hints }: Props) {
  const uid = useId();
  const api = `/api/card-groups/${groupId}`;
  const [loaded, setLoaded] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [earlier, setEarlier] = useState<Earlier[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [showEarlier, setShowEarlier] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch(api);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setContent(data.content ?? null);
      setEarlier(data.earlier ?? []);
    } catch {
      setError("Could not load your words for this. Reload the page to try again.");
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    setLoaded(false);
    setEditing(false);
    setShowEarlier(false);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  async function save(next: string | null) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(api, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(typeof body?.error === "string" ? body.error : "");
      }
      await load();
      setEditing(false);
    } catch (err) {
      setError((err instanceof Error && err.message) || "Could not save. Your text is still here; try again.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteEarlier(id: number) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/cards/${groupId}/revisions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setEarlier((list) => list.filter((v) => v.id !== id));
    } catch {
      setError("Could not delete that wording. Nothing was removed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <h2 className="text-[10px] text-ink-faint uppercase tracking-widest">What {label} mean to you</h2>

      {!loaded ? (
        <p className="text-xs text-ink-ghost">Loading…</p>
      ) : editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save(draft);
          }}
          className="space-y-2"
        >
          <label htmlFor={`${uid}-text`} className="block text-xs text-ink-faint">In your own words</label>
          <textarea
            id={`${uid}-text`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={MAX_GROUP_NOTE_LENGTH}
            rows={4}
            autoFocus
            className={`${fieldFullClass} resize-y leading-relaxed`}
          />
          <div className="flex items-center gap-2">
            <button type="submit" disabled={busy} className={buttonClass.primary}>{busy ? "Saving…" : "Save"}</button>
            <button type="button" onClick={() => { setEditing(false); setError(null); }} className={buttonClass.quiet}>Cancel</button>
          </div>
          {hints && <p className="text-[11px] text-ink-ghost">Saving an empty note clears it. The wording it replaces is kept.</p>}
        </form>
      ) : (
        <div className="space-y-1">
          {content ? (
            <p className="text-sm text-ink-strong leading-relaxed whitespace-pre-wrap break-words">{content}</p>
          ) : (
            <p className="text-sm text-ink-ghost italic">Nothing written here.</p>
          )}
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <button onClick={() => { setDraft(content ?? ""); setEditing(true); setError(null); }} className={buttonClass.text}>
              {content ? "Edit" : `Write what ${label} mean to you`}
            </button>
            {earlier.length > 0 && (
              <button
                onClick={() => setShowEarlier((v) => !v)}
                aria-expanded={showEarlier}
                className="text-xs text-ink-faint hover:text-ink-soft transition-colors"
              >
                {showEarlier ? "Hide earlier wordings" : `Earlier wordings (${earlier.length})`}
              </button>
            )}
          </p>
        </div>
      )}

      {showEarlier && earlier.length > 0 && (
        <ul className="space-y-3 list-none p-0 m-0">
          {earlier.map((v) => (
            <li key={v.id} className="space-y-1 border-l-2 border-line-strong pl-3">
              <p className="text-[10px] text-ink-ghost">
                Written{" "}
                <time dateTime={toISOString(v.created_at)} suppressHydrationWarning>
                  {parseDate(v.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                </time>
              </p>
              <p className="text-sm text-ink-soft leading-relaxed whitespace-pre-wrap break-words">{v.content}</p>
              <span className="flex gap-4">
                <button onClick={() => save(v.content)} disabled={busy} className={`${buttonClass.text} text-[10px]`}>
                  Use this version
                </button>
                <button onClick={() => deleteEarlier(v.id)} disabled={busy} className={`${buttonClass.danger} text-[10px]`}>
                  Delete this wording
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-xs text-danger" role="alert">{error}</p>}
    </div>
  );
}
