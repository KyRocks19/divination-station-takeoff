"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { ErrorNote } from "@/components/ui/Page";
import SharingNotice from "@/components/circle/SharingNotice";
import { SHARING_NOTICE } from "@/lib/circles-core";
import AppSigil from "@/components/ui/AppSigil";

/** Making an account with an invite code. The code may arrive in the link's fragment (#code=...), which is never sent to the server. */
export default function JoinForm({ circleOnly = false, host = false }: { circleOnly?: boolean; host?: boolean }) {
  const [code, setCode] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Set when the code turns out to be a circle's code: the person then reads what goes where and ticks the box before the account is made.
  const [circleName, setCircleName] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    const m = /(?:^#|&)code=([^&]+)/.exec(window.location.hash);
    if (m) {
      setCode(decodeURIComponent(m[1]));
      // The code is in the box now; take it out of the address bar and the history.
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== again) return setError("The two passwords are different.");
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, username: username.trim(), displayName: displayName.trim() || null, password, agreed }),
    }).catch(() => null);
    const body = await res?.json().catch(() => ({}));
    if (res?.ok) {
      // A full page load, so the navigation is drawn from the new session. A new account reads the privacy and terms text first.
      window.location.assign(body.privacyNeeded ? "/welcome" : "/");
      return;
    }
    if (body?.needsAgreement && typeof body.circle === "string") {
      // Nothing has been made yet: show the notice and wait for the tick box.
      setCircleName(body.circle);
      setBusy(false);
      return;
    }
    setError(body?.error ?? "That could not be done. Try again.");
    setBusy(false);
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-canvas px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <AppSigil className="h-16 w-16 mx-auto mb-3 text-tone-300" />
          <h1 className="text-2xl font-bold text-tone-300 tracking-widest">Divination Station</h1>
          <p className="text-ink-faint mt-2 text-sm">
            {circleOnly ? "Make your account with an invite code from your family and/or friends' circle" : "Make your account with a circle code"}
          </p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-xs text-ink-faint">
            {circleOnly ? "Your personal circle invite code" : "Invite code or circle code"}
            <Input value={code} onChange={(e) => { setCode(e.target.value); setCircleName(null); setAgreed(false); }} placeholder="XXXX-XXXX-XXXX" autoComplete="off" autoCapitalize="characters" spellCheck={false} className="mt-1 font-mono tracking-wider" />
          </label>
          <label className="block text-xs text-ink-faint">
            Choose a username
            <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" maxLength={40} className="mt-1" />
          </label>
          <label className="block text-xs text-ink-faint">
            Display name (optional)
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="name" maxLength={60} className="mt-1" />
          </label>
          <label className="block text-xs text-ink-faint">
            Choose a password (at least 12 characters)
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className="mt-1" />
          </label>
          <label className="block text-xs text-ink-faint">
            The password again
            <Input type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" className="mt-1" />
          </label>
          <p className="text-xs text-ink-ghost">
            Nobody can read your password, and if you forget it the owner can reset it. Before you start you will be shown a short page about who can see your writing.
          </p>
          {circleName && (
            <div className="space-y-3">
              <p role="status" className="text-sm text-ink-soft">
                This code is for the circle “{circleName}”. Making your account will also put you in that circle. Read this first.
              </p>
              <SharingNotice headingId="join-circle-notice" Heading="h2" host={host} />
              <label className="flex items-start gap-2 text-sm text-ink-soft">
                <input type="checkbox" className="accent-tone-500 mt-1" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                <span>{SHARING_NOTICE.agree}</span>
              </label>
            </div>
          )}
          {error && <ErrorNote>{error}</ErrorNote>}
          <Button type="submit" disabled={busy || !code.trim() || !username.trim() || !password || !again || (circleName !== null && !agreed)} className="w-full">
            {busy ? "Making your account…" : "Make my account"}
          </Button>
        </form>
        <p className="text-center text-xs text-ink-ghost mt-6">
          <a href="/login" className="underline hover:text-ink-soft">I already have an account</a>
          {" · "}
          <a href="/privacy" className="underline hover:text-ink-soft">Privacy and terms</a>
        </p>
      </div>
    </div>
  );
}
