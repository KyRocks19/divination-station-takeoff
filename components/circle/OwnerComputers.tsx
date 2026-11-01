"use client";

import { useState } from "react";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { parseDate } from "@/lib/date";
import { MAX_CIRCLE_COMPUTERS, type CircleView } from "@/lib/circles-core";

type Circle = NonNullable<CircleView["circle"]>;
type Act = (url: string, method: string, body: unknown, done: string | ((data: Record<string, unknown> | null) => string)) => Promise<boolean>;

/**
 * The circle owner's picture computers (open item C3): add one, copy its token once, remove one. A circle's computer makes only this circle's
 * members' pictures, never reads anyone's writing, and is not the database password. Members' picture words go to it, which the notice says.
 */
export default function OwnerComputers({ circle, busy, act, reload }: { circle: Circle; busy: boolean; act: Act; reload: () => void }) {
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<{ name: string; token: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const { computers, awake } = circle.pictures;

  async function make(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    setProblem(null);
    setFresh(null);
    setCopied(false);
    const res = await fetch(`/api/circles/${circle.id}/computers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    setWorking(false);
    if (!res?.ok) return setProblem(body?.error ?? "That could not be done. Try again.");
    setFresh({ name: body.name, token: body.token });
    setName("");
    reload();
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setProblem("Copying did not work here. Select the text and copy it by hand.");
    }
  }

  return (
    <section aria-labelledby="circle-computers" className="space-y-3 border border-line-faint rounded-control p-4">
      <h2 id="circle-computers" className="text-sm text-ink-muted font-medium">Your picture computer for this circle</h2>
      <p className="text-xs text-ink-faint">
        If you run the picture studio (<code>start-picture-studio.cmd</code>) on a computer of yours, it can make the pictures that members who agreed
        ask for, instead of the app&apos;s own computer. The words members type for a picture go to your computer, and you could read them there. It
        cannot read anyone&apos;s readings or journals. See <code>docs/picture-queue.md</code> and <code>docs/picture-model-at-home.md</code>.
      </p>
      {computers.length > 0 && (
        <>
          <p className="text-xs text-ink-faint" role="status">
            {awake ? "A computer of yours has checked in recently." : "No computer of yours has checked in recently, so members' pictures are waiting."}
          </p>
          <ul className="space-y-1">
            {computers.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 text-xs border border-line-faint rounded-control px-3 py-2">
                <span className="text-ink-soft min-w-0">
                  <span className="block truncate font-medium">{c.name}</span>
                  <span className="block text-ink-ghost">{c.last_used_at ? `last used ${parseDate(c.last_used_at).toLocaleString()}` : "not used yet"}</span>
                </span>
                <Button
                  variant="danger"
                  disabled={busy}
                  aria-label={`Remove the picture computer ${c.name}`}
                  onClick={() => {
                    if (!window.confirm(`Remove "${c.name}"? Its studio stops working at once. If it is your last one, pictures members are waiting for are given up.`)) return;
                    act(`/api/circles/${circle.id}/computers/${c.id}`, "DELETE", undefined, "The picture computer is removed.");
                  }}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
      {computers.length < MAX_CIRCLE_COMPUTERS && (
        <form onSubmit={make} className="space-y-3">
          <Field htmlFor="circle-computer-name" label="Name of the computer" hint="Whose it is or where, such as “Kitchen laptop”.">
            <Input id="circle-computer-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          </Field>
          <Button type="submit" disabled={busy || working || !name.trim()}>{working ? "Making…" : "Add a picture computer"}</Button>
        </form>
      )}
      {problem && <p role="alert" className="text-sm text-danger-ink">{problem}</p>}
      {fresh && (
        <div role="status" className="bg-field border border-line-strong rounded-control p-3 space-y-2">
          <p className="text-xs text-ink-faint">
            The token for “{fresh.name}”. Copy it now: it is shown only this once. If it is lost, remove the computer and add it again. On that computer, put
            two lines in <code>.env.local</code>: <code>APP_URL=</code> and this website&apos;s address, and <code>WORKER_TOKEN=</code> and the token.
          </p>
          <p className="font-mono text-sm break-all text-ink-strong select-all">{fresh.token}</p>
          <div className="flex flex-wrap gap-2 items-center">
            <Button variant="quiet" onClick={() => copy(`WORKER_TOKEN=${fresh.token}`)}>Copy as a line for .env.local</Button>
            {copied && <span className="text-xs text-success">Copied</span>}
          </div>
        </div>
      )}
    </section>
  );
}
