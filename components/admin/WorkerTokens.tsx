"use client";

import { useCallback, useEffect, useState } from "react";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { ErrorNote } from "@/components/ui/Page";
import { parseDate } from "@/lib/date";

interface Token {
  id: number;
  name: string;
  can_pictures: number;
  can_companion: number;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  circle_name: string | null;
}

const when = (s: string) => parseDate(s).toLocaleString();

/**
 * The owner's picture-computer tokens (admin only): make a token for one computer's picture studio, copy it once, see when each was last used,
 * revoke one. A token can only take jobs from the queue and send back their results; it is never the database password.
 */
export default function WorkerTokens() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [name, setName] = useState("");
  const [pictures, setPictures] = useState(true);
  const [companion, setCompanion] = useState(false);
  const [fresh, setFresh] = useState<{ name: string; token: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/workers").catch(() => null);
    if (res?.ok) setTokens(await res.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  async function make() {
    setBusy(true);
    setError(null);
    setFresh(null);
    setCopied(false);
    const res = await fetch("/api/admin/workers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, pictures, companion }),
    }).catch(() => null);
    const body = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) return setError(body?.error ?? "That could not be done. Try again.");
    setFresh({ name: name.trim(), token: body.token });
    setName("");
    load();
  }

  async function revoke(t: Token) {
    if (!window.confirm(`Revoke the token for "${t.name}"? That computer's studio stops working at once, and what it was making goes back in the queue.`)) return;
    const res = await fetch(`/api/admin/workers/${t.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) setError("That could not be revoked. It may already be revoked.");
    load();
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setError("Copying did not work here. Select the text and copy it by hand.");
    }
  }

  const active = tokens.filter((t) => !t.revoked_at);
  const revoked = tokens.filter((t) => t.revoked_at);

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-sm text-ink-soft">
        <p>
          A picture computer runs the picture studio (<code>start-picture-studio.cmd</code>). It takes the pictures people ask for, makes them with
          its image tool, and sends them back to this website. Each computer gets its own token here. A token can only take waiting jobs and send
          back what it made. It cannot read anyone&apos;s readings or journals, and it is not the database password.
        </p>
        <p>
          Put two lines in that computer&apos;s <code>.env.local</code>: <code>APP_URL=</code> and this website&apos;s address, and{" "}
          <code>WORKER_TOKEN=</code> and the token. See <code>docs/picture-queue.md</code>.
        </p>
      </div>

      <section aria-labelledby="new-token" className="space-y-3 border border-line-faint rounded-control p-4">
        <h2 id="new-token" className="text-sm text-ink-muted font-medium">Make a token</h2>
        <Field htmlFor="worker-name" label="Whose computer is it?" hint="A name for yourself, such as “My PC” or “Sam’s laptop”.">
          <Input id="worker-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </Field>
        <fieldset className="space-y-2">
          <legend className="text-xs text-ink-muted">What may it take from the queue?</legend>
          <label className="flex items-start gap-2 text-sm text-ink-soft min-h-11 sm:min-h-0">
            <input type="checkbox" checked={pictures} onChange={(e) => setPictures(e.target.checked)} className="accent-tone-500 mt-1" />
            <span>Pictures (the words people typed for a picture go to this computer)</span>
          </label>
          <label className="flex items-start gap-2 text-sm text-ink-soft min-h-11 sm:min-h-0">
            <input type="checkbox" checked={companion} onChange={(e) => setCompanion(e.target.checked)} className="accent-tone-500 mt-1" />
            <span>
              Companion requests. <strong>These carry people&apos;s own writing</strong> (their readings, meanings and journal entries) to this computer&apos;s
              text model. Only tick this for a computer you trust with everyone&apos;s words, such as your own.
            </span>
          </label>
        </fieldset>
        <Button disabled={busy || !name.trim()} onClick={make}>{busy ? "Making…" : "Make a token"}</Button>
        {error && <ErrorNote>{error}</ErrorNote>}
        {fresh && (
          <div role="status" className="bg-field border border-line-strong rounded-control p-3 space-y-2">
            <p className="text-xs text-ink-faint">
              The token for “{fresh.name}”. Copy it now: it is shown only this once. If it is lost, revoke it and make another.
            </p>
            <p className="font-mono text-sm break-all text-ink-strong select-all">{fresh.token}</p>
            <div className="flex flex-wrap gap-2 items-center">
              <Button variant="quiet" onClick={() => copy(`WORKER_TOKEN=${fresh.token}`)}>Copy as a line for .env.local</Button>
              {copied && <span className="text-xs text-success">Copied</span>}
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="tokens-in-use" className="space-y-2">
        <h2 id="tokens-in-use" className="text-sm text-ink-muted font-medium">Tokens in use</h2>
        {active.length === 0 ? (
          <p className="text-xs text-ink-faint">None yet.</p>
        ) : (
          <ul className="space-y-1">
            {active.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 text-xs border border-line-faint rounded-control px-3 py-2">
                <span className="text-ink-soft min-w-0">
                  <span className="block truncate font-medium">{t.name}</span>
                  <span className="block text-ink-ghost">
                    {t.circle_name ? `Circle “${t.circle_name}”: its members' pictures only` : [t.can_pictures ? "Pictures" : null, t.can_companion ? "Companion requests" : null].filter(Boolean).join(" and ")}
                    {" · "}
                    {t.last_used_at ? `last used ${when(t.last_used_at)}` : "not used yet"}
                  </span>
                </span>
                <Button variant="danger" onClick={() => revoke(t)} aria-label={`Revoke the token for ${t.name}`}>Revoke</Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {revoked.length > 0 && (
        <section aria-labelledby="tokens-revoked" className="space-y-2">
          <h2 id="tokens-revoked" className="text-sm text-ink-muted font-medium">Revoked</h2>
          <ul className="space-y-1">
            {revoked.map((t) => (
              <li key={t.id} className="text-xs text-ink-ghost border border-line-faint rounded-control px-3 py-2">
                {t.name} · revoked {when(t.revoked_at!)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
