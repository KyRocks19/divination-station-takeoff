"use client";

import { useState } from "react";
import { DAILY_OPTIONS, DAILY_SHAPES, RV_WORDS, chanceWords, practiceNumbers } from "@/lib/remoteview-core";
import type { DailyTrial } from "@/lib/remoteview-daily";
import { buttonClass } from "@/components/ui/Button";
import { parseDate } from "@/lib/date";

// Five plain shapes, drawn in a 24-wide box in the text colour. They mean nothing; each is also named in words.
const SHAPE_DRAWINGS: React.ReactNode[] = [
  <circle key="c" cx="12" cy="12" r="8" />,
  <rect key="s" x="4" y="4" width="16" height="16" />,
  <path key="t" d="M12 3.5 L21 20 H3 Z" />,
  <path key="st" d="M12 2.5 L14.6 9 L21.5 9.4 L16.2 13.8 L18 20.5 L12 16.8 L6 20.5 L7.8 13.8 L2.5 9.4 L9.4 9 Z" />,
  <path key="w" d="M2.5 12 C5 6 7.5 6 9 12 C10.5 18 13 18 15 12 C16.5 6 19 6 21.5 12" />,
];

function Shape({ i, className = "h-10 w-10" }: { i: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" className={className} aria-hidden="true" focusable="false">
      {SHAPE_DRAWINGS[i]}
    </svg>
  );
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface Props {
  initialTrials: DailyTrial[];
  initialTotals: { trials: number; hits: number };
}

/** Daily five-choice trials: start one (only its seal is shown), choose a shape, then see the target, the secret number and a check of the seal. */
export default function DailyPlay({ initialTrials, initialTotals }: Props) {
  const [trials, setTrials] = useState(initialTrials);
  const [totals, setTotals] = useState(initialTotals);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<number, boolean | null>>({});

  const waiting = trials.find((t) => !t.judged) ?? null;
  const n = practiceNumbers(totals.trials, totals.hits, 1 / DAILY_OPTIONS);

  async function call(url: string, body?: object) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(typeof data?.error === "string" ? data.error : "That did not work. Nothing was changed.");
      }
      return (await res.json()) as DailyTrial;
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    const t = await call("/api/remoteview/daily");
    if (t) setTrials((prev) => (prev.some((p) => p.id === t.id) ? prev : [t, ...prev]));
  }

  async function choose(i: number) {
    if (!waiting) return;
    const t = await call(`/api/remoteview/daily/${waiting.id}`, { choice: i });
    if (!t) return;
    setTrials((prev) => prev.map((p) => (p.id === t.id ? t : p)));
    setTotals((prev) => ({ trials: prev.trials + 1, hits: prev.hits + (t.judged?.hit ? 1 : 0) }));
  }

  async function check(t: DailyTrial) {
    if (!t.judged) return;
    const hash = await sha256Hex(`${t.judged.target_index}:${t.judged.nonce}`);
    setChecked((prev) => ({ ...prev, [t.id]: hash === t.seal_hash }));
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-muted leading-relaxed">{RV_WORDS.daily}</p>
      <p className="text-sm text-ink-muted leading-relaxed">
        {n.trials === 0
          ? "You have no answered daily trials yet."
          : `Answered: ${n.trials}. You chose the target ${n.hits} time${n.hits === 1 ? "" : "s"}. Guessing alone would give about ${n.expected.toFixed(1)}. The chance of ${n.hits} or more by guessing alone is ${chanceWords(n.chance)}. A small number of trials cannot show much either way.`}
      </p>

      {waiting ? (
        <section aria-label="Choose a shape" className="bg-surface border border-line rounded-card p-5 space-y-4">
          <p className="text-sm text-ink-muted">
            The target is chosen and hidden. Its seal: <code className="break-all text-xs text-ink-strong">{waiting.seal_hash}</code>
          </p>
          <p className="text-sm text-ink-soft">Which shape is the target?</p>
          <ul className="list-none p-0 grid grid-cols-2 sm:grid-cols-5 gap-3">
            {DAILY_SHAPES.map((name, i) => (
              <li key={name}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => choose(i)}
                  className="w-full flex flex-col items-center gap-1 bg-canvas border border-line rounded-card p-3 min-h-11 text-tone-200 hover:border-line-hover disabled:opacity-40 transition-colors"
                >
                  <Shape i={i} />
                  <span className="text-sm text-ink-strong">{name}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-faint">You can choose once. Then the target is shown.</p>
        </section>
      ) : (
        <button type="button" onClick={start} disabled={busy} className={buttonClass.primary}>
          {busy ? "Starting…" : "Start a daily trial"}
        </button>
      )}
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}

      {trials.some((t) => t.judged) && (
        <section aria-labelledby="daily-past" className="space-y-3">
          <h2 id="daily-past" className="text-xs text-ink-faint uppercase tracking-widest">Answered trials</h2>
          <ul className="list-none p-0 space-y-3">
            {trials
              .filter((t) => t.judged)
              .map((t) => (
                <li key={t.id} className="bg-surface border border-line rounded-card p-3 space-y-1 text-sm text-ink-soft">
                  <p>
                    <time dateTime={t.created_at}>{parseDate(t.created_at).toLocaleDateString()}</time>
                    {" · you chose "}
                    <strong className="text-ink-strong">{DAILY_SHAPES[t.judged!.choice_index]}</strong>
                    {", the target was "}
                    <strong className="text-ink-strong">{DAILY_SHAPES[t.judged!.target_index]}</strong>
                    {t.judged!.hit ? " (a hit)" : ""}
                  </p>
                  <p className="text-xs text-ink-faint break-all">Seal {t.seal_hash} · secret number {t.judged!.nonce}</p>
                  <button type="button" onClick={() => check(t)} className={buttonClass.text}>Check the seal</button>
                  {checked[t.id] === true && <p role="status" className="text-xs text-ink-muted">The seal matches: the target was fixed before you chose.</p>}
                  {checked[t.id] === false && <p role="alert" className="text-xs text-danger">The seal does not match.</p>}
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
