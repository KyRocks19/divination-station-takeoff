"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui/Button";

interface State {
  on: boolean;
  facts: number;
}

/** The opt-in to keep a few facts about each judged trial under a random code. It is off until the person turns it on, on this screen, which lists exactly what is kept. */
export default function ShareFacts({ initial }: { initial: State }) {
  const [state, setState] = useState(initial);
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(method: "POST" | "DELETE") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/remoteview/share", { method });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(typeof data?.error === "string" ? data.error : "");
      }
      setState(await res.json());
      setReviewing(false);
    } catch (err) {
      setError((err instanceof Error && err.message) || "That did not work. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="share-facts" className="bg-surface border border-line rounded-card p-4 space-y-3">
      <h2 id="share-facts" className="text-sm font-medium text-ink-strong">Keep trial facts (optional)</h2>
      {state.on ? (
        <>
          <p className="text-sm text-ink-muted leading-relaxed">
            This is on. {state.facts} fact{state.facts === 1 ? "" : "s"} {state.facts === 1 ? "is" : "are"} kept under a random code. You can turn it off at any time, which deletes every one of them.
          </p>
          <button type="button" onClick={() => call("DELETE")} disabled={busy} className={buttonClass.quiet}>{busy ? "Working…" : "Turn off and delete my facts"}</button>
        </>
      ) : reviewing ? (
        <div className="space-y-3">
          <p className="text-sm text-ink-muted leading-relaxed">If you turn this on, each time you answer a blind-target or daily trial, the app keeps one row with exactly these facts, and nothing else:</p>
          <ul className="list-disc pl-5 text-sm text-ink-soft space-y-0.5">
            <li>which kind of trial it was (four-option or daily five-option)</li>
            <li>how many options it had</li>
            <li>whether you chose the target (a hit) or not</li>
            <li>its number in your own run of trials (1, 2, 3 …)</li>
            <li>the week it was answered (the Monday of that week, not the day or time)</li>
          </ul>
          <p className="text-sm text-ink-muted leading-relaxed">
            Never kept: your impressions, drawings, targets, options, questions, dates or times of day, or your name or account number. The rows are filed under a random code, not your name. This is pseudonymous, not anonymous: the app
            keeps the link between you and the code so that you can delete the rows, and they are deleted if your account is. The rows stay in this app&apos;s own database and are not sent anywhere else. A small number of friends gives
            numbers too small to show much, so the main use is your own record above.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => call("POST")} disabled={busy} className={buttonClass.primary}>{busy ? "Working…" : "Turn on"}</button>
            <button type="button" onClick={() => setReviewing(false)} className={buttonClass.quiet}>Not now</button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-ink-muted leading-relaxed">Off. Nothing about your trials is kept apart from your own record.</p>
          <button type="button" onClick={() => setReviewing(true)} className={buttonClass.text}>See exactly what would be kept</button>
        </>
      )}
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </section>
  );
}
