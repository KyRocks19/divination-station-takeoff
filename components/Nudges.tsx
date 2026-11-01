"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/Page";
import { dismissedMessage, type Nudge } from "@/lib/nudges-core";

const LEAD: Record<Nudge["kind"], string> = {
  prediction: "Something you expected around now",
  lookback: "A reading from more than a week ago",
  guess: "What you sensed first: how well did it fit?",
};

/**
 * "Waiting for you" at the top of today's page: predictions whose date has come, older readings with no look-back
 * yet, and "what you sensed first" notes with no answer on how well they fitted, as gentle suggestions. Each can be opened or dismissed with one press; a dismissed one stays gone on every
 * device, and the prediction or reading itself is untouched. Nothing is drawn until the list has loaded, and nothing at
 * all when there is nothing waiting or the person turned these off in Settings.
 */
export default function Nudges() {
  const [nudges, setNudges] = useState<Nudge[] | null>(null);
  const [message, setMessage] = useState({ text: "", n: 0 });
  // The section shows only if something was waiting when the page opened, and then stays (with "Nothing else is waiting").
  const [hadAny, setHadAny] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/nudges")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!live) return;
        const found: Nudge[] = d?.nudges ?? [];
        setNudges(found);
        setHadAny(found.length > 0);
      })
      .catch(() => { if (live) setNudges([]); });
    return () => { live = false; };
  }, []);

  if (!nudges || !hadAny) return null;

  async function dismiss(n: Nudge, index: number) {
    const before = nudges!;
    const after = before.filter((x) => !(x.kind === n.kind && x.id === n.id));
    setNudges(after);
    // Focus goes to the next nudge's button (or the one before it), or the heading when none is left, never to nowhere.
    requestAnimationFrame(() => {
      const buttons = list.current?.querySelectorAll<HTMLButtonElement>("button[data-dismiss]");
      const next = buttons?.[Math.min(index, (buttons?.length ?? 1) - 1)];
      (next ?? heading.current)?.focus();
    });
    const res = await fetch("/api/nudges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: n.kind, id: n.id }),
    }).catch(() => null);
    if (!res?.ok) {
      setNudges(before);
      setMessage((m) => ({ text: "That could not be dismissed. It is back in the list; try again.", n: m.n + 1 }));
      return;
    }
    setMessage((m) => ({ text: dismissedMessage(n.kind), n: m.n + 1 }));
  }

  return (
    <section aria-labelledby="waiting-heading" className="print:hidden space-y-2">
      <SectionLabel id="waiting-heading" ref={heading} tabIndex={-1} className="focus:outline-none">
        Waiting for you
      </SectionLabel>
      {nudges.length === 0 ? (
        <p className="text-sm text-ink-muted">Nothing else is waiting.</p>
      ) : (
        <>
          <p className="text-xs text-ink-ghost">Things you might like to come back to. Open one when you like, or dismiss it.</p>
          <ul ref={list} className="space-y-2 list-none p-0">
            {nudges.map((n, i) => (
              <li
                key={`${n.kind}-${n.id}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-surface border border-success/20 rounded-xl pl-4 pr-2 py-2"
              >
                <Link href={n.href} className="flex-1 min-w-[12rem] py-1 group">
                  <span className="block text-[11px] text-ink-faint">{n.lead ?? LEAD[n.kind]}</span>
                  <span className="block text-sm text-ink-strong line-clamp-2 group-hover:underline">{n.text}</span>
                  <span className="block text-xs text-ink-faint mt-0.5 line-clamp-1">{n.detail}</span>
                </Link>
                <button
                  type="button"
                  data-dismiss
                  onClick={() => void dismiss(n, i)}
                  aria-label={`Dismiss: ${n.text}`}
                  className={buttonClass.quiet}
                >
                  Dismiss
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="text-xs text-ink-ghost flex flex-wrap gap-x-4">
        <Link href="/predictions" className="inline-flex items-center min-h-11 sm:min-h-0 hover:text-ink-muted">All predictions</Link>
        <Link href="/settings" className="inline-flex items-center min-h-11 sm:min-h-0 hover:text-ink-muted">Turn these off in Settings</Link>
      </p>
      <p role="status" className="sr-only">
        <span key={message.n}>{message.text}</span>
      </p>
    </section>
  );
}
