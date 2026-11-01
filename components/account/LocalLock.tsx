"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { FEATHERED } from "@/lib/edition";

interface Where {
  place: "drive" | "computer";
  folder: string;
  other: string;
}

/**
 * Settings, on a copy that keeps its data on this computer (docs/plan-feathered-edition.md 4.2 and 4.5): "Lock my data" on or off, and stopping the
 * app ("Stop and remove the drive" in the Feathered edition), and, on a portable copy, "Move my data" between the drive and this computer. The password is asked again before the lock changes. Turning it on shows a new set of
 * recovery codes once. On a hosted copy, or for anyone but the administrator, the server answers 404 or 403 and the card does not appear.
 */
export default function LocalLock() {
  const uid = useId();
  const [state, setState] = useState<{ locked: boolean; canLock: boolean; where: Where | null } | "absent" | null>(null);
  const [confirmMove, setConfirmMove] = useState(false);
  const [moved, setMoved] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [password, setPassword] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [stopped, setStopped] = useState(false);

  useEffect(() => {
    fetch("/api/local/lock")
      .then(async (r) => (r.ok ? setState(await r.json()) : setState("absent")))
      .catch(() => setState("absent"));
  }, []);

  async function change(e: React.FormEvent) {
    e.preventDefault();
    if (state === null || state === "absent") return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/local/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lock: !state.locked, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : "That could not be done. Nothing was changed.");
      setState({ ...state, locked: !!body.locked });
      setCodes(Array.isArray(body.codes) ? body.codes : null);
      setMessage(body.locked ? "Your data is locked now." : "Your data is no longer locked.");
      setAsking(false);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That could not be done. Nothing was changed.");
    }
    setBusy(false);
  }

  async function stop() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/local/stop", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : "The app could not be stopped.");
      setStopped(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The app could not be stopped.");
      setBusy(false);
    }
  }

  async function move() {
    if (state === null || state === "absent" || !state.where) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/local/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: state.where.place === "drive" ? "computer" : "drive" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : "The data could not be moved. It is where it was.");
      setMoved(typeof body.folder === "string" ? body.folder : state.where.other);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The data could not be moved. It is where it was.");
      setBusy(false);
    }
  }

  if (state === null || state === "absent") return null;

  if (moved) {
    return (
      <Card>
        <p role="status" className="text-sm text-ink-strong">
          Your data is now in {moved}. The app has stopped: start it again from its folder, and it opens your data there.
        </p>
      </Card>
    );
  }

  if (stopped) {
    return (
      <Card>
        <p role="status" className="text-sm text-ink-strong">
          {FEATHERED
            ? "Everything is saved and the app has stopped. You can close this window and take the drive out (on Windows, use Safely remove first)."
            : "Everything is saved and the app has stopped. You can close this window."}
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="space-y-4">
        <section aria-labelledby={`${uid}-lock`} className="space-y-2">
          <h3 id={`${uid}-lock`} className="font-semibold text-ink-strong">Lock my data</h3>
          <p className="text-xs text-ink-faint">
            {state.locked
              ? "Your writing is locked with your password: on the disk it is one sealed file that nothing else can read. The quick hide locks it again at once. If you forget the password, a recovery code is the only way back in."
              : "Your writing is in an ordinary folder that anyone who can open this computer or drive can read. Locking it seals it with your password."}
          </p>
          <p role="status" className="text-sm text-ink-soft">{state.locked ? "Locked." : "Not locked."}</p>
          {!state.locked && !state.canLock && <p className="text-xs text-ink-ghost">Locking needs a copy with one account, because the lock opens with one person&rsquo;s password.</p>}
          {codes && (
            <div className="rounded-control border border-line-strong p-3 space-y-2" role="group" aria-label="Your new recovery codes">
              <p className="text-xs text-warning-ink">Save these now, somewhere away from this computer or drive. They are not shown again, and any older codes no longer work.</p>
              <ul className="font-mono text-sm tracking-wider text-ink-strong grid grid-cols-1 sm:grid-cols-2 gap-1">
                {codes.map((c) => <li key={c}>{c}</li>)}
              </ul>
              <Button variant="quiet" onClick={() => setCodes(null)}>I have saved them</Button>
            </div>
          )}
          {!asking && (state.locked || state.canLock) && (
            <Button variant="quiet" className="border border-line-strong" onClick={() => { setAsking(true); setError(null); setMessage(null); }}>
              {state.locked ? "Turn the lock off…" : "Lock my data…"}
            </Button>
          )}
          {asking && (
            <form onSubmit={change} className="space-y-3">
              <Field
                htmlFor={`${uid}-pw`}
                label="Your password"
                hint={state.locked ? "Your data becomes an ordinary folder again, and its backups and pictures plain files." : "You will be shown a new set of recovery codes."}
                error={error}
              >
                <Input id={`${uid}-pw`} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={busy || !password}>{busy ? "Working…" : state.locked ? "Turn the lock off" : "Lock my data"}</Button>
                <Button variant="quiet" onClick={() => { setAsking(false); setPassword(""); setError(null); }}>Cancel</Button>
              </div>
            </form>
          )}
          {message && <p role="status" className="text-sm text-ink-soft">{message}</p>}
        </section>

        {state.where && (
          <section aria-labelledby={`${uid}-where`} className="space-y-2 border-t border-line pt-4">
            <h3 id={`${uid}-where`} className="font-semibold text-ink-strong">Where your data is</h3>
            <p className="text-sm text-ink-soft">
              {state.where.place === "drive" ? "On the drive, beside the app." : "On this computer."}
            </p>
            <p className="text-xs text-ink-ghost break-all">{state.where.folder}</p>
            <p className="text-xs text-ink-faint">
              {state.where.place === "drive"
                ? "Moving it to this computer leaves a folder on this computer on purpose, and the drive then holds only the app: your data opens only when the drive is in this computer."
                : "Moving it to the drive takes it off this computer, so you can carry it with you."}
            </p>
            {!confirmMove ? (
              <Button variant="quiet" className="border border-line-strong" disabled={busy} onClick={() => { setConfirmMove(true); setError(null); }}>
                {state.where.place === "drive" ? "Move it to this computer…" : "Move it to the drive…"}
              </Button>
            ) : (
              <div role="group" aria-label="Confirm moving your data" className="space-y-2 rounded-control border border-line-strong p-3">
                <p className="text-sm text-ink-soft">
                  Your data is saved, copied to {state.where.other}, checked, and then removed from where it is now. The app then stops, and you start it again.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={busy} onClick={move}>{busy ? "Moving…" : "Move my data"}</Button>
                  <Button variant="quiet" disabled={busy} onClick={() => setConfirmMove(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </section>
        )}

        <section aria-labelledby={`${uid}-stop`} className="space-y-2 border-t border-line pt-4">
          <h3 id={`${uid}-stop`} className="font-semibold text-ink-strong">{FEATHERED ? "Stop and remove the drive" : "Stop the app"}</h3>
          <p className="text-xs text-ink-faint">
            Saves everything{state.locked ? ", sealed," : ""} and stops the app on this computer. To use it again, start it from its folder.
          </p>
          <Button variant="quiet" className="border border-line-strong" disabled={busy} onClick={stop}>{FEATHERED ? "Stop and remove the drive" : "Stop the app"}</Button>
          {error && !asking && <p role="alert" className="text-xs text-danger">{error}</p>}
        </section>
      </div>
    </Card>
  );
}
