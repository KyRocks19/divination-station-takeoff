"use client";

import { useAiReady } from "@/components/AiReady";
import { adultOnlyThings } from "@/lib/ai-ready-core";
import { useEffect, useId, useState } from "react";
import { Card } from "@/components/ui/Card";
import { reloadPrefs, usePrefs } from "@/components/usePrefs";

/**
 * "I am 18 or older" (owner decision 2026-10-22, lib/adult.ts): one confirmation, off until the person ticks it, that unlocks the sensitive
 * meanings, the AI companion and the Claude buttons. Everything else in the app is open to every age. Unticking it locks them again.
 */
export default function AdultSetting() {
  const uid = useId();
  const prefs = usePrefs();
  const words = adultOnlyThings(useAiReady());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  // The box changes at once and goes back if the answer could not be saved.
  const [checked, setChecked] = useState(prefs.adultConfirmed);
  useEffect(() => setChecked(prefs.adultConfirmed), [prefs.adultConfirmed]);

  async function change(next: boolean) {
    setBusy(true);
    setNote("");
    setChecked(next);
    const res = await fetch("/api/adult", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adult: next }),
    }).catch(() => null);
    if (res?.ok) {
      await reloadPrefs();
      setNote(next ? "Saved. The features below are available." : words.locked);
    } else {
      setChecked(!next);
      setNote((await res?.json().catch(() => null))?.error ?? "That could not be saved. Try again.");
    }
    setBusy(false);
  }

  return (
    <Card className="space-y-3" role="group" aria-labelledby={`${uid}-h`}>
      <h3 id={`${uid}-h`} className="font-semibold text-ink-strong">Age</h3>
      <p className="text-sm text-ink-muted">
        {/* Only the AI features this copy has are named (none in Feathered). */}
        {words.intro}
      </p>
      <label className="flex items-center gap-3 min-h-11 text-sm text-ink cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          disabled={busy}
          onChange={(e) => change(e.target.checked)}
          className="accent-[var(--color-focus)]"
        />
        I am 18 or older
      </label>
      <p role="status" className="text-xs text-ink-faint min-h-4">{note}</p>
    </Card>
  );
}
