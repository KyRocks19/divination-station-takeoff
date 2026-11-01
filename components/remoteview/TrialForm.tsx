"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_OPTION_CHARS, OPTION_COUNT, RV_WORDS, cleanOptions } from "@/lib/remoteview-core";
import { fieldClass } from "@/components/ui/Field";
import { buttonClass } from "@/components/ui/Button";

/** Four possible targets are typed here (by the person or by a friend); the app picks one and keeps it sealed. */
export default function TrialForm() {
  const router = useRouter();
  const baseId = useId();
  const [options, setOptions] = useState<string[]>(Array.from({ length: OPTION_COUNT }, () => ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ok = cleanOptions(options) !== null;

  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !ok) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/remoteview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ options, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(typeof body?.error === "string" ? body.error : "");
      }
      const saved = await res.json();
      router.push(`/remoteview/${saved.id}`);
    } catch (err) {
      setError((err instanceof Error && err.message) || "Could not start the trial. Nothing was saved.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={start} className="bg-surface border border-line rounded-card p-5 space-y-4">
      <p className="text-sm text-ink-muted leading-relaxed">{RV_WORDS.blind}</p>
      <fieldset className="space-y-3">
        <legend className="text-xs text-ink-faint mb-1">Four different targets, for example a place, an object, a picture you will keep out of sight, or a person</legend>
        {options.map((value, i) => (
          <div key={i}>
            <label htmlFor={`${baseId}-${i}`} className="block text-xs text-ink-faint mb-1">Target {i + 1}</label>
            <input
              id={`${baseId}-${i}`}
              type="text"
              value={value}
              maxLength={MAX_OPTION_CHARS}
              onChange={(e) => setOptions((prev) => prev.map((p, j) => (j === i ? e.target.value : p)))}
              className={`w-full ${fieldClass}`}
              autoComplete="off"
            />
          </div>
        ))}
      </fieldset>
      <p className="text-xs text-ink-faint leading-relaxed">
        The targets are not shown again until you have sealed your impression. Your export includes the targets of a trial only after you have chosen.
      </p>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      <button type="submit" disabled={busy || !ok} className={buttonClass.primary}>{busy ? "Starting…" : "Start the trial"}</button>
      {!ok && options.some((o) => o.trim()) && <p role="status" className="text-xs text-ink-muted">All four boxes need a different target.</p>}
    </form>
  );
}
