"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorNote } from "@/components/ui/Page";

/** "I have read this": remembers it, then goes on to where the person was headed. A full page load so the navigation is drawn again. */
export default function AcknowledgeButton({ next }: { next: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/privacy/ack", { method: "POST" }).catch(() => null);
    if (!res?.ok) {
      setBusy(false);
      return setError("That could not be saved. Try again.");
    }
    window.location.assign(next);
  }

  return (
    <div className="pt-4 space-y-2">
      <Button disabled={busy} onClick={go}>{busy ? "One moment…" : "I have read this"}</Button>
      {error && <ErrorNote>{error}</ErrorNote>}
    </div>
  );
}
