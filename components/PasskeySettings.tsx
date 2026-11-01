"use client";

import { FEATHERED } from "@/lib/edition";
import { useCallback, useEffect, useId, useState } from "react";
import { browserSupportsWebAuthn, startRegistration } from "@simplewebauthn/browser";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { PASSKEY_NAME_MAX } from "@/lib/passkeys-core";

interface Passkey {
  id: number;
  name: string;
  created_at: string;
  last_used_at: string | null;
}

const day = (s: string) => new Date(s).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

/**
 * Passkeys (S10): another way to sign in, beside the password. Adding one asks for the current password first. Only the public half of the
 * passkey is kept; the fingerprint, face or PIN that unlocks it stays on the device.
 */
function PasskeySettingsInner() {
  const uid = useId();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/passkeys").catch(() => null);
    if (!res?.ok) return;
    const body = (await res.json()) as { passkeys: Passkey[] };
    setPasskeys(body.passkeys);
  }, []);

  useEffect(() => {
    setSupported(browserSupportsWebAuthn());
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/passkeys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const options = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(options.error ?? "That could not be started. Try again.");
      let response;
      try {
        response = await startRegistration({ optionsJSON: options });
      } catch {
        throw new Error("The device did not make a passkey. Nothing was added.");
      }
      const done = await fetch("/api/passkeys/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ response, name }) });
      const answer = await done.json().catch(() => ({}));
      if (!done.ok) throw new Error(answer.error ?? "The passkey could not be added. Try again.");
      setNote({ ok: true, text: "Passkey added. Next time, you can sign in with it." });
      setName("");
      setPassword("");
      await load();
    } catch (err) {
      setNote({ ok: false, text: err instanceof Error ? err.message : "Something went wrong. Try again." });
    }
    setBusy(false);
  }

  async function remove(p: Passkey) {
    if (!window.confirm(`Remove the passkey "${p.name}"? You can still sign in with your password.`)) return;
    const res = await fetch(`/api/passkeys/${p.id}`, { method: "DELETE" }).catch(() => null);
    setNote(res?.ok ? { ok: true, text: `"${p.name}" is removed.` } : { ok: false, text: "That could not be removed. Try again." });
    await load();
  }

  return (
    <Card className="space-y-4" role="group" aria-labelledby={`${uid}-h`}>
      <div>
        <h3 id={`${uid}-h`} className="font-semibold text-ink-strong">Passkeys</h3>
        <p className="text-xs text-ink-faint mt-1">
          A passkey lets you sign in with your fingerprint, your face, your device&apos;s PIN or a security key instead of typing your password. Your password
          still works. This app keeps only the public half of a passkey and the name you give it; what unlocks it never leaves your device. A passkey
          works only at the address you add it on.
        </p>
      </div>

      {passkeys.length > 0 && (
        <ul className="space-y-2" aria-label="Your passkeys">
          {passkeys.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
              <span>
                <span className="text-ink-strong">{p.name}</span>
                <span className="block text-xs text-ink-faint">
                  Added {day(p.created_at)}
                  {p.last_used_at ? ` · last used ${day(p.last_used_at)}` : " · not used yet"}
                </span>
              </span>
              <Button variant="danger" onClick={() => remove(p)} aria-label={`Remove the passkey ${p.name}`}>Remove</Button>
            </li>
          ))}
        </ul>
      )}

      {supported === false ? (
        <p className="text-xs text-ink-faint">This browser cannot make passkeys, or this address is not a secure one (passkeys need https, or this computer itself).</p>
      ) : (
        <form onSubmit={add} className="space-y-3">
          <Field htmlFor={`${uid}-name`} label="A name for it" hint="For example the device it is on.">
            <Input id={`${uid}-name`} value={name} onChange={(e) => setName(e.target.value)} maxLength={PASSKEY_NAME_MAX} placeholder="My phone" />
          </Field>
          <Field htmlFor={`${uid}-pw`} label="Your current password">
            <Input id={`${uid}-pw`} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </Field>
          <Button type="submit" disabled={busy || !password || supported === null}>{busy ? "Waiting for your device…" : "Add a passkey"}</Button>
        </form>
      )}
      <p role="status" className={`text-sm min-h-5 ${note?.ok === false ? "text-danger-ink" : "text-success-ink"}`}>{note?.text}</p>
    </Card>
  );
}

/** Not in the Feathered edition, which has no AI (docs/plan-feathered-edition.md). */
export default function PasskeySettings() {
  return FEATHERED ? null : <PasskeySettingsInner />;
}
