"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { ErrorNote } from "@/components/ui/Page";

// The steps of the /host page (open item H2.3). The words follow docs/host-guide.md; the checks are the ones the app can make itself: whether host
// mode is on, and whether an address is saved. Everything Tailscale or Headscale does is the leader's, so it is shown, never run.

export interface HostState {
  hostMode: boolean;
  names: string[];
  acknowledgedAt: string | null;
  port: number;
  circleMax: number;
}

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children: React.ReactNode }) {
  const id = `host-step-${n}`;
  return (
    <Card aria-labelledby={id} role="region" className="space-y-2">
      <h2 id={id} className="text-sm font-medium text-ink-strong">
        {n}. {title}
        {done !== undefined && <span className={done ? "text-success ml-2" : "text-ink-ghost ml-2"}>{done ? "Done" : "Not yet"}</span>}
      </h2>
      <div className="space-y-2 text-sm text-ink-muted leading-relaxed">{children}</div>
    </Card>
  );
}

function Command({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="bg-surface-sunken border border-line rounded-control px-2 py-1 text-ink-strong text-xs break-all">{text}</code>
      <Button variant="quiet" onClick={copy} className="min-h-6">{copied ? "Copied" : "Copy"}</Button>
    </div>
  );
}

export default function HostSetup({ initial, backups }: { initial: HostState; backups: string | null }) {
  const [state, setState] = useState(initial);
  const [address, setAddress] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function change(body: object, done: string) {
    setBusy(true);
    setError(null);
    setSaved(null);
    const res = await fetch("/api/local/host", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError(data?.error ?? "That could not be saved. Try again.");
    setState(data as HostState);
    setSaved(done);
    setAddress("");
  }

  const acknowledged = state.acknowledgedAt !== null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft leading-relaxed">
        This page sets up this copy so the friends in your circle can use it from their own devices, through Tailscale or Headscale. Nothing is put on
        the public internet. The full guide is HOSTING.md in the app&apos;s folder.
      </p>

      <Step n={1} title="What hosting means for your friends" done={acknowledged}>
        {/* The backups folder is a long path with no spaces; it wraps instead of pushing the page sideways on a phone. */}
        <p className="[overflow-wrap:anywhere]">
          Everything your friends write here is stored on this computer, without end-to-end encryption, so you can read it. Their backups are kept
          beside your data folder{backups ? ` (${backups})` : ""}. They are told this before they join. Keep this computer and the app up to date, and
          keep it awake while they use it.
        </p>
        {!acknowledged ? (
          <div className="space-y-2">
            <label className="flex items-start gap-2 text-sm text-ink-soft">
              <input type="checkbox" className="accent-tone-500 mt-1" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
              <span>I understand that I can read what my friends write here, and I will keep it private.</span>
            </label>
            <Button disabled={!understood || busy} onClick={() => change({ acknowledge: true }, "Confirmed.")}>Confirm</Button>
          </div>
        ) : (
          <p className="text-ink-faint text-xs">Confirmed on {new Date(state.acknowledgedAt!).toLocaleDateString()}.</p>
        )}
      </Step>

      <Step n={2} title="Turn host mode on" done={state.hostMode}>
        {state.hostMode ? (
          <p>Host mode is on. The Circle, Forum and Join pages are there, and a circle holds up to {state.circleMax} people.</p>
        ) : (
          <>
            <p>Host mode is off. Stop the app, add this line to settings.env in the app&apos;s folder (copy settings.example.env if there is none), and start it again:</p>
            <Command text="DS_MODE=host" />
          </>
        )}
        <p>
          A circle holds 10 people unless you set DS_HOST_CIRCLE_MAX (2 to 30) in the same file. A free Tailscale plan suits a small circle; use
          Headscale for a larger one.
        </p>
      </Step>

      <Step n={3} title="Give this computer a private address">
        <p>With Tailscale: install it, sign in, then run this in a terminal. It prints an address such as https://my-pc.tail1234.ts.net.</p>
        <Command text={`tailscale serve --bg ${state.port}`} />
        <p>
          Then run tailscale serve status: it must show no Funnel line. Never use tailscale funnel for this, because it makes the app public.
        </p>
        <p>
          With Headscale: put an HTTPS proxy (Caddy or nginx, with a certificate for the name your friends will use) in front of
          http://127.0.0.1:{state.port}, reachable only on your Headscale network. The app needs HTTPS to keep people signed in.
        </p>
      </Step>

      <Step n={4} title="Tell this copy the address" done={state.names.length > 0}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            change({ add: address }, "Saved. It works within a few seconds.");
          }}
          className="space-y-2"
        >
          <Field htmlFor="host-address" label="The address your friends will open" hint={acknowledged ? "Paste it as printed, for example https://my-pc.tail1234.ts.net" : "Confirm step 1 first."}>
            <Input id="host-address" value={address} onChange={(e) => setAddress(e.target.value)} disabled={!acknowledged} autoComplete="off" spellCheck={false} />
          </Field>
          <Button type="submit" disabled={!acknowledged || busy || !address.trim()}>{busy ? "Saving…" : "Save the address"}</Button>
        </form>
        {state.names.length > 0 && (
          <ul aria-label="Addresses this copy answers to" className="space-y-1">
            {state.names.map((n) => (
              <li key={n} className="flex flex-wrap items-center gap-2">
                <a href={`https://${n}`} className="text-accent-ink hover:text-accent-ink-hover underline break-all">https://{n}</a>
                <Button variant="text" className="min-h-6" disabled={busy} onClick={() => change({ remove: n }, "Removed.")} aria-label={`Remove ${n}`}>Remove</Button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-ink-ghost">Open the address on this computer to test it. A name in ALLOWED_HOSTS in settings.env works too, after a restart.</p>
      </Step>

      <Step n={5} title="Let your friends reach this computer">
        <p>
          With Tailscale: in the admin console, Machines, open this computer&apos;s menu, choose Share, and share it with each friend&apos;s Tailscale
          account. If other programs run on this computer, limit shared friends to the app&apos;s port with an access rule.
        </p>
        <p>With Headscale: add each friend&apos;s devices, and use access rules so they reach only this computer, and only the app.</p>
        <p>Each friend installs Tailscale (or joins your Headscale network), accepts the share, opens the address, and chooses &ldquo;I have an invite code&rdquo;.</p>
      </Step>

      <Step n={6} title="Make the circle and its code" done={undefined}>
        <p>
          On <Link href="/circle" className="text-accent-ink hover:text-accent-ink-hover underline">Your circle</Link>, make the circle and a circle
          code, and send the code to your friends with the address.
        </p>
      </Step>

      {error && <ErrorNote>{error}</ErrorNote>}
      {saved && <p role="status" className="text-sm text-success">{saved}</p>}
    </div>
  );
}
