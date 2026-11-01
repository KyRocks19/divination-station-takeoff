"use client";

import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { ErrorNote } from "@/components/ui/Page";
import { parseDate } from "@/lib/date";
import NavGlyph from "@/components/ui/NavGlyph";

interface Invite {
  id: number;
  note: string | null;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  used_by_username: string | null;
  status: "waiting" | "used" | "expired" | "revoked";
}

const day = (s: string) => parseDate(s).toLocaleDateString();

/** The owner's invite codes (shown only to an admin in Settings): make a single-use code, copy it, see who used it, revoke an unused one. */
export default function InviteCodes() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [note, setNote] = useState("");
  const [fresh, setFresh] = useState<{ code: string; expires_at: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/invites").catch(() => null);
    if (res?.ok) setInvites(await res.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  async function make() {
    setBusy(true);
    setError(null);
    setFresh(null);
    const res = await fetch("/api/admin/invites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note }) }).catch(() => null);
    const body = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) return setError(body?.error ?? "That could not be done. Try again.");
    setFresh({ code: body.code, expires_at: body.expires_at });
    setNote("");
    load();
  }

  async function revoke(id: number) {
    const res = await fetch(`/api/admin/invites/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) setError("That could not be revoked. It may already be used.");
    load();
  }

  async function copy(what: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
    } catch {
      setError("Copying did not work here. Select the text and copy it by hand.");
    }
  }

  return (
    <div className="border-t border-line-faint pt-4 space-y-3">
      <h3 className="flex items-center gap-2 text-sm text-ink-muted font-medium">
        <NavGlyph id="admin" className="h-4 w-4 shrink-0" />
        Invite codes
      </h3>
      <p className="text-xs text-ink-faint">
        A code works once and stops working after 14 days. The person it is for makes their own username and password at /join. The code is shown
        only now, when you make it; if it is lost, revoke it and make another.
      </p>
      <div className="flex gap-2">
        <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={100} placeholder="A note for yourself, such as who it is for (optional)" aria-label="A note for yourself about this code" />
        <Button disabled={busy} onClick={make} className="whitespace-nowrap">{busy ? "Making…" : "Make a code"}</Button>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      {fresh && (
        <div role="status" className="bg-field border border-line-strong rounded-control p-3 space-y-2">
          <p className="text-xs text-ink-faint">Your new code (until {day(fresh.expires_at)}). Copy it now:</p>
          <p className="font-mono text-lg tracking-wider text-ink-strong select-all">{fresh.code}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="quiet" onClick={() => copy("code", fresh.code)}>Copy the code</Button>
            <Button variant="quiet" onClick={() => copy("link", `${window.location.origin}/join#code=${fresh.code}`)}>Copy an invite link</Button>
            {copied && <span className="text-xs text-success self-center">Copied the {copied}</span>}
          </div>
        </div>
      )}
      {invites.length > 0 && (
        <ul className="space-y-1">
          {invites.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 text-xs border border-line-faint rounded-control px-3 py-2">
              <span className="text-ink-soft min-w-0">
                <span className="block truncate">{i.note || "No note"}</span>
                <span className="block text-ink-ghost">
                  {i.status === "waiting" && `Unused, until ${day(i.expires_at)}`}
                  {i.status === "used" && `Used${i.used_by_username ? ` by ${i.used_by_username}` : ""} on ${day(i.used_at!)}`}
                  {i.status === "expired" && `Expired on ${day(i.expires_at)}`}
                  {i.status === "revoked" && "Revoked"}
                </span>
              </span>
              {i.status === "waiting" && <Button variant="danger" onClick={() => revoke(i.id)} aria-label={`Revoke the code ${i.note ? `for ${i.note}` : `made on ${day(i.created_at)}`}`}>Revoke</Button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
