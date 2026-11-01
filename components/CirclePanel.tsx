"use client";

import { useCallback, useEffect, useState } from "react";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { ErrorNote } from "@/components/ui/Page";
import { parseDate } from "@/lib/date";
import OwnerClaudeKey from "@/components/circle/OwnerClaudeKey";
import MyAgreement from "@/components/circle/MyAgreement";
import OwnerComputers from "@/components/circle/OwnerComputers";
import SharingNotice from "@/components/circle/SharingNotice";
import { MAX_CIRCLE_NAME, MAX_CIRCLE_NOTE, type CircleInvite, type CircleView } from "@/lib/circles-core";

const day = (s: string) => parseDate(s).toLocaleDateString();

const STATUS_WORDS: Record<CircleInvite["status"], string> = {
  waiting: "waiting",
  used: "used",
  expired: "expired",
  revoked: "revoked",
};

/** Sends a change and returns the error text, or null when it worked. */
async function send(url: string, method: string, body?: unknown): Promise<{ error: string | null; data: Record<string, unknown> | null }> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => null);
  if (!res) return { error: "The app could not be reached. Check the connection and try again.", data: null };
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  return { error: res.ok ? null : (data?.error as string) ?? "That could not be done. Try again.", data };
}

/**
 * The person's circle (first build): join one with a code, make one if an admin allowed it, and for the owner, codes, members, a new name,
 * handing over and deleting. Only names are shown, never anyone's writing.
 */
export default function CirclePanel({ host = false }: { host?: boolean }) {
  const [view, setView] = useState<CircleView | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [code, setCode] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [newName, setNewName] = useState("");
  const [rename, setRename] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [fresh, setFresh] = useState<{ code: string; note: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/circles").catch(() => null);
    if (!res) return setUnavailable("The app could not be reached. Check the connection and reload the page.");
    const body = await res.json().catch(() => null);
    if (!res.ok) return setUnavailable(body?.error ?? "Your circle could not be loaded. Reload the page to try again.");
    setUnavailable(null);
    setView(body);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  /** Runs one change, shows its error or a confirmation, and reloads the circle. */
  async function act(url: string, method: string, body: unknown, done: string | ((data: Record<string, unknown> | null) => string)): Promise<boolean> {
    setBusy(true);
    setError(null);
    setNotice(null);
    const { error, data } = await send(url, method, body);
    setBusy(false);
    if (error) {
      setError(error);
      return false;
    }
    setNotice(typeof done === "function" ? done(data) : done);
    await load();
    return true;
  }

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (await act("/api/circles/join", "POST", { code, agreed }, "You joined the circle.")) {
      setCode("");
      setAgreed(false);
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (await act("/api/circles", "POST", { name: newName }, "Your circle is made. Make a code below to invite someone.")) setNewName("");
  }

  async function makeCode(circleId: number) {
    setBusy(true);
    setError(null);
    setNotice(null);
    setFresh(null);
    setCopied(false);
    const { error, data } = await send(`/api/circles/${circleId}/invites`, "POST", { note });
    setBusy(false);
    if (error || !data) return setError(error ?? "That could not be done. Try again.");
    setFresh({ code: String(data.code), note: note.trim() });
    setNote("");
    load();
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setError("Copying did not work here. Select the code and copy it by hand.");
    }
  }

  if (unavailable) return <ErrorNote>{unavailable}</ErrorNote>;
  if (!view) return <p className="text-sm text-ink-faint" role="status">Loading your circle…</p>;

  const messages = (
    <>
      {error && <ErrorNote>{error}</ErrorNote>}
      <p role="status" className="text-sm text-success empty:hidden">{notice}</p>
    </>
  );

  const about = (
    <p className="text-sm text-ink-soft">
      A circle is a household or a group of friends. The person who runs it can share their own Claude key and picture computer with it, so the
      group does not depend on the app&apos;s. <strong>Being in a circle shares none of your readings, journals or other
      writing.</strong> The others see only your name.
    </p>
  );

  // Not in a circle: join one, or make one when allowed.
  if (!view.circle) {
    return (
      <div className="space-y-6">
        {about}
        {messages}
        <section aria-labelledby="join-circle" className="space-y-3 border border-line-faint rounded-control p-4">
          <h2 id="join-circle" className="text-sm text-ink-muted font-medium">Join a circle</h2>
          <form onSubmit={join} className="space-y-3">
            <Field htmlFor="circle-code" label="Code" hint="The code the circle's owner gave you, such as K7QM-2XPD-9TWR. Capitals and dashes do not matter.">
              <Input id="circle-code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" spellCheck={false} maxLength={40} />
            </Field>
            <SharingNotice headingId="join-notice" host={host} />
            <label className="flex items-start gap-2 text-sm text-ink-soft">
              <input type="checkbox" className="mt-1" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>I have read what goes where, and I agree</span>
            </label>
            <Button type="submit" disabled={busy || !code.trim() || !agreed}>{busy ? "Joining…" : "Join"}</Button>
          </form>
        </section>
        {view.can_make ? (
          <section aria-labelledby="make-circle" className="space-y-3 border border-line-faint rounded-control p-4">
            <h2 id="make-circle" className="text-sm text-ink-muted font-medium">Make a circle</h2>
            <form onSubmit={create} className="space-y-3">
              <Field htmlFor="circle-name" label="Name" hint="For example your household's name. You can change it later.">
                <Input id="circle-name" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={MAX_CIRCLE_NAME} />
              </Field>
              <Button type="submit" disabled={busy || !newName.trim()}>{busy ? "Making…" : "Make the circle"}</Button>
            </form>
          </section>
        ) : (
          <p className="text-xs text-ink-faint">To make a circle of your own, ask the person who runs this app to switch it on for you.</p>
        )}
      </div>
    );
  }

  const c = view.circle;

  return (
    <div className="space-y-6">
      {about}
      {messages}

      <section aria-labelledby="circle-name-heading" className="space-y-2">
        <h2 id="circle-name-heading" className="text-lg text-ink-strong font-medium break-words">{c.name}</h2>
        <p className="text-xs text-ink-faint">
          {c.is_owner ? "You run this circle." : "You are a member of this circle."} {c.members.length} of {c.max_members} people · made {day(c.created_at)}
        </p>
        {c.is_owner && (rename === null ? (
          <Button variant="text" onClick={() => setRename(c.name)}>Rename</Button>
        ) : (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await act(`/api/circles/${c.id}`, "PATCH", { name: rename }, "The circle has its new name.")) setRename(null);
            }}
          >
            <Field htmlFor="circle-rename" label="New name">
              <Input id="circle-rename" value={rename} onChange={(e) => setRename(e.target.value)} maxLength={MAX_CIRCLE_NAME} />
            </Field>
            <Button type="submit" disabled={busy || !rename.trim()}>Save</Button>
            <Button variant="text" onClick={() => setRename(null)}>Cancel</Button>
          </form>
        ))}
      </section>

      <section aria-labelledby="circle-members" className="space-y-2">
        <h2 id="circle-members" className="text-sm text-ink-muted font-medium">People in this circle</h2>
        <ul className="space-y-1">
          {c.members.map((m) => {
            const name = m.display_name || m.username;
            return (
              <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 text-sm border border-line-faint rounded-control px-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-ink-strong">
                    {name}
                    {m.display_name && <span className="text-ink-ghost text-xs"> ({m.username})</span>}
                  </span>
                  <span className="block text-xs text-ink-ghost">
                    {m.is_owner ? "Runs the circle" : `Joined ${day(m.joined_at)}`}
                    {c.is_owner && c.claude.has_key && (m.agreed ? ` · Claude through your key today: ${m.ai_today ?? 0}` : " · has not agreed to use your key")}
                  </span>
                </span>
                {c.is_owner && !m.is_owner && (
                  <span className="flex flex-wrap gap-2">
                    <Button
                      variant="text"
                      disabled={busy}
                      aria-label={`Hand over the circle to ${name}`}
                      onClick={() => {
                        if (!window.confirm(`Hand "${c.name}" to ${name}? They will run it, and you will stay in it as a member.`)) return;
                        act(`/api/circles/${c.id}/owner`, "POST", { user_id: m.user_id }, `${name} runs the circle now.`);
                      }}
                    >
                      Hand over
                    </Button>
                    <Button
                      variant="danger"
                      disabled={busy}
                      aria-label={`Remove ${name} from the circle`}
                      onClick={() => {
                        if (!window.confirm(`Take ${name} out of "${c.name}"? Nothing of theirs is deleted.`)) return;
                        act(`/api/circles/${c.id}/members/${m.user_id}`, "DELETE", undefined, `${name} is no longer in the circle.`);
                      }}
                    >
                      Remove
                    </Button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <MyAgreement
        host={host}
        circle={c}
        busy={busy}
        onChange={(agree) => act(`/api/circles/${c.id}/agreement`, "PUT", { agreed: agree }, agree ? "You now use the circle's key and computer." : "You stopped using the circle's key and computer.")}
      />

      {c.is_owner && <OwnerClaudeKey circle={c} busy={busy} act={act} />}

      {c.is_owner && <OwnerComputers circle={c} busy={busy} act={act} reload={load} />}

      {c.is_owner && (
        <section aria-labelledby="circle-invite" className="space-y-3 border border-line-faint rounded-control p-4">
          <h2 id="circle-invite" className="text-sm text-ink-muted font-medium">Invite someone</h2>
          <p className="text-xs text-ink-faint">
            A code works once, for 7 days, and only for someone who already has an account here. They type it on their own Circle page.
          </p>
          <Field htmlFor="circle-note" label="Who is it for? (optional)" hint="A note for yourself, so you know which code went to whom.">
            <Input id="circle-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={MAX_CIRCLE_NOTE} />
          </Field>
          <Button disabled={busy} onClick={() => makeCode(c.id)}>{busy ? "Making…" : "Make a code"}</Button>
          {fresh && (
            <div role="status" className="bg-field border border-line-strong rounded-control p-3 space-y-2">
              <p className="text-xs text-ink-faint">
                {fresh.note ? `The code for ${fresh.note}. ` : "Your code. "}Copy it now: it is shown only this once. If it is lost, revoke it and make another.
              </p>
              <p className="font-mono text-lg tracking-wider break-all text-ink-strong select-all">{fresh.code}</p>
              <div className="flex flex-wrap gap-2 items-center">
                <Button variant="quiet" onClick={() => copy(fresh.code)}>Copy the code</Button>
                {copied && <span className="text-xs text-success">Copied</span>}
              </div>
            </div>
          )}
          {view.invites.length > 0 && (
            <div className="space-y-1">
              <h3 className="text-xs text-ink-muted">Codes</h3>
              <ul className="space-y-1">
                {view.invites.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 text-xs border border-line-faint rounded-control px-3 py-2">
                    <span className="text-ink-soft min-w-0">
                      <span className="block truncate">{i.note ?? "No note"}</span>
                      <span className="block text-ink-ghost">
                        {STATUS_WORDS[i.status]}
                        {i.status === "used" && i.used_by_name ? ` by ${i.used_by_name}` : ""}
                        {i.status === "waiting" ? ` · works until ${day(i.expires_at)}` : ""}
                      </span>
                    </span>
                    {i.status === "waiting" && (
                      <Button
                        variant="danger"
                        disabled={busy}
                        aria-label={`Revoke the code${i.note ? ` for ${i.note}` : ""}`}
                        onClick={() => act(`/api/circles/${c.id}/invites/${i.id}`, "DELETE", undefined, "That code no longer works.")}
                      >
                        Revoke
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="circle-leave" className="space-y-2">
        <h2 id="circle-leave" className="text-sm text-ink-muted font-medium">{c.is_owner ? "Delete the circle" : "Leave the circle"}</h2>
        {c.is_owner ? (
          <>
            <p className="text-xs text-ink-faint">
              To leave, hand the circle to someone first. Deleting it takes everyone out of it; nobody&apos;s writing is touched.
            </p>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => {
                if (!window.confirm(`Delete "${c.name}"? Everyone in it will no longer be in a circle. Nobody's writing is deleted.`)) return;
                act(`/api/circles/${c.id}`, "DELETE", undefined, "The circle is deleted.");
              }}
            >
              Delete the circle
            </Button>
          </>
        ) : (
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => {
              if (!window.confirm(`Leave "${c.name}"? You can join again only with a new code from its owner.`)) return;
              act(`/api/circles/${c.id}/members/${view.my_id}`, "DELETE", undefined, "You left the circle.");
            }}
          >
            Leave the circle
          </Button>
        )}
      </section>
    </div>
  );
}
