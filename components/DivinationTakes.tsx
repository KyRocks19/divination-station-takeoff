"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import {
  DIVINATION_SLUG, OWN_TAKE_MAX_LENGTH, OWN_TONE_LABEL, TAKES, TONE_LABELS, TONE_ORDER, cleanOwnTake, homeOrder, nextVisibleIndex, takeById,
  visibleTakes, type DivinationTake, type OwnTake, type TakeSlot,
} from "@/lib/divination-takes-core";

// The takes on divination (lib/divination-takes-core.ts): one under the home page title, and every one on the Divination
// archetype page, each with Keep and Hide buttons. Keeping saves at once (PUT or DELETE /api/divination-takes/<id>), and so
// does hiding (PUT or DELETE /api/divination-takes/<id>/hidden); a press that cannot be saved puts the button back and says
// so. A take is never kept and hidden at once: keeping a hidden take shows it again, and hiding a kept take lets go of it.
// The person's own takes (/api/own-takes) are written and deleted on the Divination page, and come round on the home page
// among the others (homeOrder).

type Choice = "keep" | "hide";

function useTakeChoices(initialKept: string[], initialHidden: string[]) {
  const [kept, setKept] = useState<Set<string>>(() => new Set(initialKept));
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(initialHidden));
  const [message, setMessage] = useState({ text: "", n: 0 });
  const busy = useRef(new Set<string>());
  const say = (text: string) => setMessage((m) => ({ text, n: m.n + 1 }));

  const put = (setter: typeof setKept, id: string, on: boolean) =>
    setter((s) => {
      if (s.has(id) === on) return s;
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  /** Saves one choice for one take. True when it was saved; on failure both buttons are put back as they were. */
  async function choose(take: DivinationTake, choice: Choice, on: boolean): Promise<boolean> {
    if (busy.current.has(take.id)) return false;
    busy.current.add(take.id);
    const wasKept = kept.has(take.id);
    const wasHidden = hidden.has(take.id);
    if (choice === "keep") {
      put(setKept, take.id, on);
      if (on) put(setHidden, take.id, false);
    } else {
      put(setHidden, take.id, on);
      if (on) put(setKept, take.id, false);
    }
    try {
      const url = `/api/divination-takes/${encodeURIComponent(take.id)}${choice === "hide" ? "/hidden" : ""}`;
      const res = await fetch(url, { method: on ? "PUT" : "DELETE" });
      if (!res.ok) throw new Error();
      if (choice === "keep") say(on ? "Kept. It is with your takes on the Divination page." : "Taken out of your kept takes.");
      else say(on ? "Hidden. It will not come round on the home page; you can show it again on the Divination page." : "Shown again. It can come round on the home page.");
      return true;
    } catch {
      put(setKept, take.id, wasKept);
      put(setHidden, take.id, wasHidden);
      if (choice === "keep") say(on ? "Could not keep that take. Nothing changed; try again." : "Could not take that out. It is still kept; try again.");
      else say(on ? "Could not hide that take. Nothing changed; try again." : "Could not show that take again. It is still hidden; try again.");
      return false;
    } finally {
      busy.current.delete(take.id);
    }
  }

  const status = (
    <p role="status" className="sr-only">
      <span key={message.n}>{message.text}</span>
    </p>
  );
  return { kept, hidden, choose, status, message: message.text };
}

function KeepButton({ on, onPress }: { on: boolean; onPress: () => void }) {
  return (
    <Button variant="text" aria-pressed={on} onClick={onPress} className="min-h-6 shrink-0 inline-flex items-center gap-1">
      <span aria-hidden="true">{on ? "♥" : "♡"}</span>
      {on ? "Kept" : "Keep"}
    </Button>
  );
}

function HideButton({ hidden, onPress }: { hidden: boolean; onPress: () => void }) {
  return (
    <Button variant="text" onClick={onPress} className="min-h-6 shrink-0">
      {hidden ? "Show again" : "Hide"}
    </Button>
  );
}

/**
 * The line under the home page title: one take, its kind, and buttons for another take, for keeping it and for hiding it.
 * The person's own takes come round too. Hidden takes are left out of the order; one hidden here moves on to the next, with
 * Undo next to it until the next press.
 */
export function HomeTake({ seed, kept: initialKept, hidden: initialHidden, own }: { seed: number; kept: string[]; hidden: string[]; own: OwnTake[] }) {
  const [stock] = useState(() => visibleTakes(initialHidden));
  const [order] = useState(() => homeOrder(seed, stock.length, own.length));
  const [at, setAt] = useState(order.length > 0 ? 0 : -1);
  const [undo, setUndo] = useState<{ take: DivinationTake; at: number } | null>(null);
  const { kept, hidden, choose, status } = useTakeChoices(initialKept, initialHidden);
  const isHidden = (s: TakeSlot, also?: string) => !s.own && (hidden.has(stock[s.i].id) || stock[s.i].id === also);

  async function hide(take: DivinationTake) {
    const from = at;
    setUndo({ take, at: from });
    setAt(nextVisibleIndex(order, from, (s) => isHidden(s, take.id)));
    if (!(await choose(take, "hide", true))) {
      setAt(from);
      setUndo(null);
    }
  }

  async function undoHide() {
    if (!undo) return;
    const { take, at: back } = undo;
    if (await choose(take, "hide", false)) {
      setAt(back);
      setUndo(null);
    }
  }

  function another() {
    setUndo(null);
    setAt((i) => {
      const n = nextVisibleIndex(order, i, (s) => isHidden(s));
      return n === -1 ? i : n;
    });
  }

  const slot = at >= 0 ? order[at] : null;
  const take = slot && !slot.own ? stock[slot.i] : null;
  const text = slot ? (slot.own ? own[slot.i].text : stock[slot.i].text) : "You have hidden every take.";
  return (
    <figure className="max-w-xl mx-auto space-y-1.5">
      <blockquote className="text-lg text-ink-soft leading-relaxed" aria-live="polite">
        <p>{text}</p>
      </blockquote>
      <figcaption className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-ink-faint">
        {slot && (
          <>
            <span>{take ? TONE_LABELS[take.tone] : OWN_TONE_LABEL}</span>
            <span aria-hidden="true">·</span>
            <Button variant="text" onClick={another} className="min-h-6">
              Another take
            </Button>
          </>
        )}
        {take && <KeepButton on={kept.has(take.id)} onPress={() => { setUndo(null); choose(take, "keep", !kept.has(take.id)); }} />}
        {take && <HideButton hidden={false} onPress={() => hide(take)} />}
        {undo && (
          <Button variant="text" onClick={undoHide} className="min-h-6">
            Undo hide
          </Button>
        )}
        <Link href={`/archetypes/${DIVINATION_SLUG}`} className="text-accent-ink hover:text-accent-ink-hover underline max-sm:inline-flex max-sm:items-center max-sm:min-h-11">
          {!slot ? "Show takes again" : take ? "All takes" : "Your takes"}
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

/**
 * Every take, on the Divination archetype page: the person's own first, then the ones they kept, then the ones they hid,
 * then the rest by kind. Each of the app's takes has Keep and Hide (or Show again).
 */
export function TakesList({ kept: initialKept, hidden: initialHidden, own }: { kept: string[]; hidden: string[]; own: OwnTake[] }) {
  const { kept, hidden, choose, status } = useTakeChoices(initialKept, initialHidden);
  // The kept and hidden lists are as they were when the page opened; a take kept or hidden here joins them next time, so nothing moves under the pointer.
  const [keptFirst] = useState(() => initialKept.map(takeById).filter((x): x is DivinationTake => !!x));
  const [hiddenFirst] = useState(() => initialHidden.map(takeById).filter((x): x is DivinationTake => !!x));
  const row = (take: DivinationTake, showKind: boolean) => {
    const isHidden = hidden.has(take.id);
    return (
      <li key={take.id} className="flex items-start justify-between gap-3 py-1.5 border-b border-line last:border-b-0">
        <span className={`text-sm leading-relaxed ${isHidden ? "text-ink-faint" : "text-ink-soft"}`}>
          {take.text}
          {showKind && <span className="text-ink-ghost"> · {TONE_LABELS[take.tone]}</span>}
          {isHidden && <span className="text-ink-ghost"> · Hidden</span>}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <KeepButton on={kept.has(take.id)} onPress={() => choose(take, "keep", !kept.has(take.id))} />
          <HideButton hidden={isHidden} onPress={() => choose(take, "hide", !isHidden)} />
        </span>
      </li>
    );
  };
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
      <div className="space-y-1">
        <h3 className="text-xs text-ink-faint">Your hidden takes ({hidden.size})</h3>
        {hiddenFirst.length > 0 ? (
          <ul className="list-none p-0">{hiddenFirst.map((t) => row(t, true))}</ul>
        ) : (
          <p className="text-sm text-ink-faint">None hidden. Press Hide on a take you do not want to see again, here or on the home page.</p>
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
