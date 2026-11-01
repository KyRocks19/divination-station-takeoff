"use client";

import { useEffect, useId, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MAX_RECENT, NO_RECENT, type RecentState } from "@/lib/recent-searches-core";

/**
 * Settings: the switch for remembering searches, and a button to delete the list. The same switch is in the search window; this is
 * the place that does not depend on opening it. The list lives in the person's account (migration 071), is shown only to them,
 * and is in their export. Turning it off deletes it.
 */
export default function RecentSearchesSetting() {
  const uid = useId();
  const [state, setState] = useState<RecentState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/search/recent")
      .then(async (r) => setState(r.ok ? ((await r.json()) as RecentState) : NO_RECENT))
      .catch(() => setState(NO_RECENT));
  }, []);

  async function call(method: "PUT" | "DELETE", body?: unknown, done?: string) {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/search/recent", {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return setMessage("That could not be done. Nothing was changed.");
    setState((await res.json()) as RecentState);
    if (done) setMessage(done);
  }

  const count = state?.items.length ?? 0;
  return (
    <Card className="space-y-3" role="group" aria-labelledby={`${uid}-h`}>
      <div>
        <h3 id={`${uid}-h`} className="font-semibold text-ink-strong">Recent searches</h3>
        <p className="text-xs text-ink-faint mt-0.5">
          The search window can remember the words of the searches you opened a result from (the latest {MAX_RECENT}), so you can run one again. They are kept
          in your account, shown only to you, not sent to Claude, and they are in your export. They are off until you turn them on.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
        <input
          type="checkbox"
          checked={state?.on ?? false}
          disabled={state === null || busy}
          onChange={(e) => call("PUT", { on: e.target.checked }, e.target.checked ? "On." : "Off. The saved searches were deleted.")}
          className="accent-[var(--color-focus)]"
        />
        <span>Remember my searches</span>
      </label>
      <p className="text-xs text-ink-faint">Turning this off deletes the saved searches.</p>
      <p className="text-xs text-ink-faint" role="status">
        {message ?? (state === null ? "" : state.on ? (count > 0 ? `${count} saved search${count === 1 ? "" : "es"}.` : "Nothing saved yet.") : "Off. Nothing is being kept.")}
      </p>
      {state?.on && count > 0 && (
        <Button variant="quiet" disabled={busy} onClick={() => call("DELETE", undefined, "The saved searches were deleted.")}>
          Delete the saved searches
        </Button>
      )}
    </Card>
  );
}
