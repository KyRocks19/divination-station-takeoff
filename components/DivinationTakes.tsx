"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import {
  DIVINATION_SLUG, OWN_TAKE_MAX_LENGTH, OWN_TONE_LABEL, TAKES, TONE_LABELS, TONE_ORDER, cleanOwnTake, homeOrder, nextTakeIndex, takeById,
  type DivinationTake, type OwnTake,
} from "@/lib/divination-takes-core";

// The takes on divination (lib/divination-takes-core.ts): one under the home page title, and every one on the Divination
// archetype page, each with a Keep button. Keeping saves at once (PUT or DELETE /api/divination-takes/<id>); a press that
// cannot be saved puts the button back and says so. The person's own takes (/api/own-takes) are written and deleted on the
// Divination page, and come round on the home page among the others (homeOrder).

function useKept(initial: string[]) {
  const [kept, setKept] = useState<Set<string>>(() => new Set(initial));
  const [message, setMessage] = useState({ text: "", n: 0 });
  const busy = useRef(new Set<string>());
  const say = (text: string) => setMessage((m) => ({ text, n: m.n + 1 }));

  async function toggle(take: DivinationTake) {
    if (busy.current.has(take.id)) return;
    busy.current.add(take.id);
    const keep = !kept.has(take.id);
    const flip = (on: boolean) =>
      setKept((k) => {
        const next = new Set(k);
        if (on) next.add(take.id);
        else next.delete(take.id);
        return next;
      });
    flip(keep);
    try {
      const res = await fetch(`/api/divination-takes/${encodeURIComponent(take.id)}`, { method: keep ? "PUT" : "DELETE" });
      if (!res.ok) throw new Error();
      say(keep ? "Kept. It is with your takes on the Divination page." : "Taken out of your kept takes.");
    } catch {
      flip(!keep);
      say(keep ? "Could not keep that take. Nothing changed; try again." : "Could not take that out. It is still kept; try again.");
    } finally {
      busy.current.delete(take.id);
    }
  }

  const status = (
    <p role="status" className="sr-only">
      <span key={message.n}>{message.text}</span>
    </p>
  );
  return { kept, toggle, status, message: message.text };
}

function KeepButton({ take, on, onPress }: { take: DivinationTake; on: boolean; onPress: () => void }) {
  return (
    <Button variant="text" aria-pressed={on} onClick={onPress} className="min-h-6 shrink-0 inline-flex items-center gap-1">
      <span aria-hidden="true">{on ? "♥" : "♡"}</span>
      {on ? "Kept" : "Keep"}
    </Button>
  );
}

/** The line under the home page title: one take, its kind, and buttons for another take and for keeping it. The person's own takes come round too. */
export function HomeTake({ seed, kept: initial, own }: { seed: number; kept: string[]; own: OwnTake[] }) {
  const [order] = useState(() => homeOrder(seed, TAKES.length, own.length));
  const [at, setAt] = useState(0);
  const { kept, toggle, status } = useKept(initial);
  const slot = order[at];
  const take = slot.own ? null : TAKES[slot.i];
  const text = slot.own ? own[slot.i].text : TAKES[slot.i].text;
  return (
    <figure className="max-w-xl mx-auto space-y-1.5">
      <blockquote className="text-lg text-ink-soft leading-relaxed" aria-live="polite">
        <p>{text}</p>
      </blockquote>
      <figcaption className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-ink-faint">
        <span>{take ? TONE_LABELS[take.tone] : OWN_TONE_LABEL}</span>
        <span aria-hidden="true">·</span>
        <Button variant="text" onClick={() => setAt((i) => nextTakeIndex(i, order.length))} className="min-h-6">
          Another take
        </Button>
        {take && <KeepButton take={take} on={kept.has(take.id)} onPress={() => toggle(take)} />}
        <Link href={`/archetypes/${DIVINATION_SLUG}`} className="text-accent-ink hover:text-accent-ink-hover underline max-sm:inline-flex max-sm:items-center max-sm:min-h-11">
          {take ? "All takes" : "Your takes"}
        </Link>
      </figcaption>
      {status}
    </figure>
  );
}

/** The person's own takes on the Divination page: a box to write one, and each one with Delete (confirmed next to it). */
function OwnTakes({ initial }: { initial: OwnTake[] }) {
  const inputId = useId();
  const [takes, setTakes] = useState(initial);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [message, setMessage] = useState({ text: "", n: 0 });
  const say = (text: string) => setMessage((m) => ({ text, n: m.n + 1 }));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const text = cleanOwnTake(draft);
    if (!text) {
      setError(draft.trim() ? `A take is up to ${OWN_TAKE_MAX_LENGTH} characters.` : "Write a take first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/own-takes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.take) throw new Error(data?.error);
      setTakes((t) => [...t, data.take]);
      setDraft("");
      say("Saved. It will come round on the home page.");
    } catch (err) {
      setError(`${(err as Error).message || "Could not save your take"}. Your words are still in the box; try again.`);
    } finally {
      setBusy(false);
    }
  }

  async function remove(t: OwnTake) {
    try {
      const res = await fetch(`/api/own-takes/${t.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setTakes((all) => all.filter((x) => x.id !== t.id));
      setConfirming(null);
      say("Deleted.");
    } catch {
      say("Could not delete that take. It is still here; try again.");
    }
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs text-ink-faint">Your own takes ({takes.length})</h3>
      {takes.length > 0 && (
        <ul className="list-none p-0">
          {takes.map((t) => (
            <li key={t.id} className="flex items-start justify-between gap-3 py-1.5 border-b border-line last:border-b-0">
              <span className="text-sm text-ink-soft leading-relaxed">{t.text}</span>
              {confirming === t.id ? (
                <span className="flex shrink-0 items-center gap-2 text-xs text-ink-faint">
                  Delete this take?
                  <Button variant="danger" onClick={() => remove(t)} className="min-h-6">Delete</Button>
                  <Button variant="text" onClick={() => setConfirming(null)} className="min-h-6">Keep it</Button>
                </span>
              ) : (
                <Button variant="danger" onClick={() => setConfirming(t.id)} aria-label={`Delete your take: ${t.text}`} className="min-h-6 shrink-0">
                  Delete
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="space-y-2">
        <Field htmlFor={inputId} label="Write a take of your own" hint={`One line, up to ${OWN_TAKE_MAX_LENGTH} characters. Only you see it.`} error={error}>
          <Input id={inputId} value={draft} maxLength={OWN_TAKE_MAX_LENGTH + 50} onChange={(e) => setDraft(e.target.value)} placeholder="Divination is…" />
        </Field>
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save take"}</Button>
      </form>
      <p role="status" className="sr-only">
        <span key={message.n}>{message.text}</span>
      </p>
    </div>
  );
}

/** Every take, on the Divination archetype page: the person's own first, then the ones they kept, then the rest by kind. */
export function TakesList({ kept: initial, own }: { kept: string[]; own: OwnTake[] }) {
  const { kept, toggle, status } = useKept(initial);
  // The kept list is the order they were kept in when the page opened; a take kept here joins it next time, so nothing moves under the pointer.
  const [keptFirst] = useState(() => initial.map(takeById).filter((x): x is DivinationTake => !!x));
  const row = (take: DivinationTake, showKind: boolean) => (
    <li key={take.id} className="flex items-start justify-between gap-3 py-1.5 border-b border-line last:border-b-0">
      <span className="text-sm text-ink-soft leading-relaxed">
        {take.text}
        {showKind && <span className="text-ink-ghost"> · {TONE_LABELS[take.tone]}</span>}
      </span>
      <KeepButton take={take} on={kept.has(take.id)} onPress={() => toggle(take)} />
    </li>
  );
  return (
    <div className="space-y-4">
      <OwnTakes initial={own} />
      <div className="space-y-1">
        <h3 className="text-xs text-ink-faint">Your kept takes ({kept.size})</h3>
        {keptFirst.length > 0 ? (
          <ul className="list-none p-0">{keptFirst.map((t) => row(t, true))}</ul>
        ) : (
          <p className="text-sm text-ink-faint">None kept yet. Press Keep on a take you like, here or on the home page.</p>
        )}
      </div>
      <details className="space-y-2">
        <summary className="text-sm text-accent-ink hover:text-accent-ink-hover cursor-pointer min-h-11 sm:min-h-0 flex items-center">
          Every take ({TAKES.length})
        </summary>
        {TONE_ORDER.map((tone) => (
          <div key={tone} className="space-y-1 pt-2">
            <h3 className="text-xs text-ink-faint">{TONE_LABELS[tone]}</h3>
            <ul className="list-none p-0">{TAKES.filter((x) => x.tone === tone).map((x) => row(x, false))}</ul>
          </div>
        ))}
      </details>
      {status}
    </div>
  );
}
