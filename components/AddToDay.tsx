"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { ErrorNote } from "@/components/ui/Page";
import { SNAPSHOT_ONLY, type ItemKind } from "@/lib/days-core";

/** Today's date in the person's own time zone, as YYYY-MM-DD ("en-CA" writes it that way). */
const localToday = () => new Date().toLocaleDateString("en-CA");

/**
 * "Add to a day" next to a reading or a kept answer. The person picks the day (today unless they change it) and chooses each time between a snapshot
 * (a copy of what it says now) and a live link (shows the current version). A snapshot links back to where it came from unless they untick that.
 */
export default function AddToDay({ kind, refId }: { kind: ItemKind; refId: number }) {
  const ids = useId();
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(localToday);
  const snapshotOnly = SNAPSHOT_ONLY.includes(kind);
  const [mode, setMode] = useState<"snapshot" | "link">("snapshot");
  const [linkBack, setLinkBack] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedTo, setAddedTo] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/days/${day}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, ref_id: refId, mode: snapshotOnly ? "snapshot" : mode, link_back: linkBack }),
    }).catch(() => null);
    const body = await res?.json().catch(() => ({}));
    setBusy(false);
    if (res?.ok) {
      setAddedTo(day);
      setOpen(false);
      return;
    }
    setError(body?.error ?? "That could not be added. Try again.");
  }

  if (!open) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <button onClick={() => { setOpen(true); setAddedTo(null); setDay(localToday()); }} className="text-xs text-accent-ink hover:underline">
          Add to a day
        </button>
        {addedTo && (
          <span role="status" className="text-xs text-success">
            Added. <Link href={`/days/${addedTo}`} className="underline">Open that day</Link>
          </span>
        )}
      </span>
    );
  }

  return (
    <fieldset className="space-y-2 bg-field border border-line rounded-control p-3 max-w-md">
      <legend className="text-xs text-ink-faint px-1">Add to a day</legend>
      <div>
        <label htmlFor={`${ids}-day`} className="block text-xs text-ink-faint mb-1">Which day</label>
        <Input id={`${ids}-day`} type="date" value={day} onChange={(e) => setDay(e.target.value)} wide={false} />
      </div>
      {snapshotOnly ? (
        <p className="text-xs text-ink-soft"><strong className="font-medium">A snapshot.</strong> A copy of what it says now, kept on that day. (It cannot be a live link: it is only held for a day.)</p>
      ) : (
        <div className="space-y-1.5">
          <label className="flex items-start gap-2 text-xs text-ink-soft cursor-pointer">
            <input type="radio" name={`${ids}-mode`} checked={mode === "snapshot"} onChange={() => setMode("snapshot")} className="accent-tone-600 mt-0.5" />
            <span><strong className="font-medium">A snapshot.</strong> A copy of what it says now, kept on that day even if the original changes or is deleted.</span>
          </label>
          <label className="flex items-start gap-2 text-xs text-ink-soft cursor-pointer">
            <input type="radio" name={`${ids}-mode`} checked={mode === "link"} onChange={() => setMode("link")} className="accent-tone-600 mt-0.5" />
            <span><strong className="font-medium">A live link.</strong> Shows the current version each time you open the day.</span>
          </label>
        </div>
      )}
      {mode === "snapshot" && (
        <label className="flex items-center gap-2 text-xs text-ink-soft cursor-pointer">
          <input type="checkbox" checked={linkBack} onChange={(e) => setLinkBack(e.target.checked)} className="accent-tone-600" />
          Link back to where it came from
        </label>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex gap-2">
        <Button disabled={busy || !day} onClick={add}>{busy ? "Adding…" : "Add"}</Button>
        <Button variant="quiet" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </fieldset>
  );
}
