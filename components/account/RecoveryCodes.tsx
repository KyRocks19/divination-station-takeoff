"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { RECOVERY_COUNT, remainingWords, type RecoveryStatus } from "@/lib/recovery-core";

/**
 * The recovery codes that let a person set a new password if they forget it: what they are, how many are left, and making a set (the
 * password is asked again). Used in Settings and on the "Before you start" screen right after joining, so nobody has to find them first.
 * `heading` is the level of the title, so the page's own headings stay in order.
 */
export default function RecoveryCodes({ heading: Heading = "h3" }: { heading?: "h2" | "h3" }) {
  const [status, setStatus] = useState<RecoveryStatus | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [asking, setAsking] = useState(false);
  const [password, setPassword] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The control that was pressed goes away when the form or the codes open or close, which would drop keyboard and
  // screen-reader focus to the top of the page. Each change names where focus goes next (an element id).
  const focusNext = useRef<string | null>(null);
  useEffect(() => {
    if (!focusNext.current) return;
    document.getElementById(focusNext.current)?.focus();
    focusNext.current = null;
  }, [asking, codes]);

  useEffect(() => {
    fetch("/api/settings/recovery")
      .then(async (r) => (r.ok ? setStatus(await r.json()) : setUnavailable(true)))
      .catch(() => setUnavailable(true));
  }, []);

  async function makeCodes(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        focusNext.current = "new-recovery-codes";
        setCodes(body.codes);
        setStatus({ remaining: body.codes.length, madeAt: new Date().toISOString() });
        setAsking(false);
        setPassword("");
      } else {
        setError(body.error ?? "Could not make the codes.");
      }
    } catch {
      setError("Could not reach the server. Nothing was changed.");
    }
    setBusy(false);
  }

  async function copyCodes() {
    try {
      await navigator.clipboard.writeText((codes ?? []).join("\n"));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-2">
      <Heading className="text-sm font-medium text-ink-strong">Recovery codes</Heading>
      <p className="text-xs text-ink-faint">
        There is no email here, so if you forget your password the owner has to reset it. Recovery codes let you do it yourself: you get {RECOVERY_COUNT}{" "}
        single-use codes, and one of them at the sign-in page&rsquo;s &ldquo;I forgot my password&rdquo; link lets you choose a new password. Keep them
        somewhere only you can reach (a password manager, or paper).
      </p>
      {unavailable ? (
        <p className="text-xs text-ink-ghost">Recovery codes are not available on this copy of the app yet.</p>
      ) : (
        status && <p className="text-sm text-ink-soft" role="status">{remainingWords(status)}</p>
      )}

      {codes && (
        <div id="new-recovery-codes" tabIndex={-1} className="rounded-control border border-line-strong p-3 space-y-2" role="group" aria-label="Your new recovery codes">
          <p className="text-xs text-warning-ink">Save these now. They are not shown again, and any older unused codes no longer work.</p>
          <ul className="font-mono text-sm tracking-wider text-ink-strong grid grid-cols-1 sm:grid-cols-2 gap-1">
            {codes.map((c) => <li key={c}>{c}</li>)}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button variant="quiet" onClick={copyCodes}>{copied ? "Copied" : "Copy the codes"}</Button>
            <Button variant="quiet" onClick={() => { focusNext.current = "recovery-open"; setCodes(null); setCopied(false); }}>I have saved them</Button>
          </div>
        </div>
      )}

      {!unavailable && !asking && !codes && (
        <Button id="recovery-open" variant="primary" onClick={() => { focusNext.current = "recovery-password"; setAsking(true); }}>
          {status?.madeAt ? "Make a new set" : "Make recovery codes"}
        </Button>
      )}
      {asking && (
        <form onSubmit={makeCodes} className="space-y-3">
          <Field htmlFor="recovery-password" label="Your password" hint={status?.madeAt ? "A new set replaces the unused codes you have now." : undefined} error={error}>
            <Input id="recovery-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy || !password}>{busy ? "Making…" : "Make the codes"}</Button>
            <Button variant="quiet" onClick={() => { focusNext.current = "recovery-open"; setAsking(false); setPassword(""); setError(null); }}>Cancel</Button>
          </div>
        </form>
      )}
    </div>
  );
}
