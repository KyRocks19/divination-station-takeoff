"use client";

import { useEffect, useId, useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { KIND_WORDS, sizeLabel, type BackupInfo } from "@/lib/local-backup-core";
import { cx } from "@/lib/cx";

/**
 * Settings, on a copy that keeps its data in a folder on this computer: make a backup, download one, and replace everything with one. On a hosted
 * copy (or for anyone but the administrator) the server answers 404 or 403 and the card does not appear. Restoring asks first, in words next to the button.
 */
export default function LocalBackups() {
  const uid = useId();
  const [state, setState] = useState<{ backups: BackupInfo[]; folder: string | null } | "absent" | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/local/backups").catch(() => null);
    if (!res || res.status === 404 || res.status === 403 || res.status === 401) return setState("absent");
    const body = await res.json().catch(() => null);
    setState(body && Array.isArray(body.backups) ? { backups: body.backups, folder: typeof body.folder === "string" ? body.folder : null } : "absent");
  }

  useEffect(() => {
    void load();
  }, []);

  async function backUp() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/local/backups", { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof body?.error === "string" ? body.error : "The backup could not be made.");
      setMessage("Backup made.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The backup could not be made.");
    } finally {
      setBusy(false);
    }
  }

  async function restore(name: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/local/backups/${encodeURIComponent(name)}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: name }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof body?.error === "string" ? body.error : "The restore could not be done. Nothing was changed.");
      setMessage("Restored. Taking you to the sign-in page…");
      setConfirming(null);
      // A full page load: the person is signed out, and every page is drawn again from the restored data.
      window.setTimeout(() => window.location.assign("/login"), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The restore could not be done. Nothing was changed.");
      setBusy(false);
    }
  }

  if (state === null || state === "absent") return null;
  const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

  return (
    <Card>
      <div className="space-y-3">
        <div>
          <h3 id={`${uid}-h`} className="font-semibold text-ink-strong">Back up and restore this copy</h3>
          <p className="text-xs text-ink-faint mt-0.5">
            This copy keeps everything in a folder on this computer. A backup is one file of all of it, kept in a backups folder beside that one. A backup on the same disk
            does not help if the disk fails, so copy the file somewhere else too. To bring in a backup from another computer, put its file in the backups folder and reload this page.
          </p>
          {state.folder && <p className="text-xs text-ink-ghost mt-1 break-all">Backups folder: {state.folder}</p>}
        </div>
        <div>
          <Button disabled={busy} onClick={backUp} aria-describedby={`${uid}-h`}>{busy && !confirming ? "Working…" : "Back up now"}</Button>
        </div>
        {message && <p role="status" className="text-sm text-ink-soft">{message}</p>}
        {error && <p role="alert" className="text-xs text-danger">{error}</p>}

        {state.backups.length === 0 ? (
          <p className="text-sm text-ink-faint">There are no backups yet.</p>
        ) : (
          <ul aria-label="Backups, newest first" className="divide-y divide-line">
            {state.backups.map((b) => (
              <li key={b.name} className="py-2 space-y-2">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-sm text-ink-strong">{when(b.madeAt)}</span>
                  <span className="text-xs text-ink-faint">{KIND_WORDS[b.kind]} · {sizeLabel(b.bytes)}</span>
                  <span className="flex gap-3 ml-auto">
                    <a href={`/api/local/backups/${encodeURIComponent(b.name)}`} download className={cx(buttonClass.text, "min-h-6 py-1")} aria-label={`Download the backup from ${when(b.madeAt)}`}>Download</a>
                    <Button variant="text" disabled={busy} className="min-h-6 py-1" onClick={() => { setConfirming(b.name); setError(null); setMessage(null); }} aria-label={`Restore the backup from ${when(b.madeAt)}`}>Restore…</Button>
                  </span>
                </div>
                {confirming === b.name && (
                  <div role="group" aria-label={`Confirm restoring the backup from ${when(b.madeAt)}`} className="space-y-2 rounded-control border border-line-strong p-3">
                    <p className="text-sm text-ink-soft">
                      This replaces everything in this copy with the backup from {when(b.madeAt)}. Whatever you wrote after that time will be gone from this copy. What is here now is saved
                      first as its own backup, so you can come back to it. You will be signed out.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button disabled={busy} onClick={() => restore(b.name)}>{busy ? "Restoring…" : "Replace everything with this backup"}</Button>
                      <Button variant="quiet" disabled={busy} onClick={() => setConfirming(null)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
