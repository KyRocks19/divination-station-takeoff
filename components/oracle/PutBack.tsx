"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/ui/Button";
import type { FormWords } from "@/lib/oracle-forms";

/** Shows how many items are set aside and puts them all back, so every one can be drawn again. */
export default function PutBack({ deckId, resting, w }: { deckId: number; resting: number; w: FormWords }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [done, setDone] = useState(false);

  async function putBack() {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch(`/api/oracle/decks/${deckId}/wake`, { method: "POST" });
      if (!res.ok) throw new Error();
      setDone(true);
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  if (done) return <p role="status" className="text-sm text-ink-muted">Everything is back in the {w.group}.</p>;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <p className="text-sm text-ink-muted">{resting} {resting === 1 ? w.one : w.many} set aside (resting).</p>
      <button type="button" onClick={putBack} disabled={busy} className={buttonClass.text}>
        {busy ? "Putting back…" : `Put everything back in the ${w.group}`}
      </button>
      {error && <p role="alert" className="text-xs text-danger">Could not put them back. Nothing changed.</p>}
    </div>
  );
}

