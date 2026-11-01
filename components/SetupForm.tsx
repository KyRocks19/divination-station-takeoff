"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { ErrorNote } from "@/components/ui/Page";
import AppSigil from "@/components/ui/AppSigil";

/**
 * First run of a copy that keeps its data on this computer: the one account. In the Feathered edition (`offerLock`) it also asks whether to lock the
 * data with the password, locked first (docs/plan-feathered-edition.md 4.2); a locked copy shows its recovery codes once before going on. A portable copy
 * (`computerFolder`, the folder it would use) also asks where the data is kept: on the drive first, or on this computer (4.3).
 */
export default function SetupForm({ offerLock = false, computerFolder = null }: { offerLock?: boolean; computerFolder?: string | null }) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lock, setLock] = useState(true);
  const [onComputer, setOnComputer] = useState(false);
  const [codes, setCodes] = useState<{ list: string[]; next: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== again) return setError("The two passwords are different.");
    setBusy(true);
    setError(null);
    const res = await fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.trim(), displayName: displayName.trim() || null, password, ...(offerLock ? { lock } : {}), ...(computerFolder ? { place: onComputer ? "computer" : "drive" } : {}) }),
    }).catch(() => null);
    const body = await res?.json().catch(() => ({}));
    if (res?.ok) {
      const next = body.privacyNeeded ? "/welcome" : "/";
      // A locked copy's recovery codes are the only way back if the password is forgotten: shown once, here, before anything else.
      if (Array.isArray(body.codes)) {
        setCodes({ list: body.codes, next });
        setBusy(false);
        return;
      }
      // A full page load, so the navigation is drawn from the new session. A new account reads the privacy and terms text first.
      window.location.assign(body.privacyNeeded ? "/welcome" : "/");
      return;
    }
    setError(body?.error ?? "That could not be done. Try again.");
    setBusy(false);
  }

  async function copyCodes() {
    try {
      await navigator.clipboard.writeText((codes?.list ?? []).join("\n"));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (codes) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-canvas px-4 py-8">
        <div className="w-full max-w-sm space-y-4">
          <h1 className="text-xl font-bold text-tone-300">Your recovery codes</h1>
          <p className="text-sm text-ink-soft">
            Your writing is locked with your password. If you forget the password, one of these codes is the only way back in. Nobody else can open it
            for you, not even the people who made the app. Write them down, or keep them in a password manager, somewhere away from this drive.
          </p>
          <ul className="font-mono text-sm tracking-wider text-ink-strong grid grid-cols-2 gap-1 rounded-control border border-line-strong p-3" aria-label="Your recovery codes">
            {codes.list.map((c) => <li key={c}>{c}</li>)}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button variant="quiet" onClick={copyCodes}>{copied ? "Copied" : "Copy the codes"}</Button>
            <Button onClick={() => window.location.assign(codes.next)}>I have saved them</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-canvas px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <AppSigil className="h-16 w-16 mx-auto mb-3 text-tone-300" />
          <h1 className="text-2xl font-bold text-tone-300 tracking-widest">Divination Station</h1>
          <p className="text-ink-faint mt-2 text-sm">Set up this copy on your computer</p>
        </div>
        <p className="text-sm text-ink-soft mb-4">
          {offerLock
            ? "Everything you write stays with this copy of the app, beside it on this drive or computer. Make the account that opens it."
            : "Everything you write is kept in a folder on this computer. Make the account that opens it."}
        </p>
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-xs text-ink-faint">
            Choose a username
            <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" maxLength={40} autoFocus className="mt-1" />
          </label>
          <label className="block text-xs text-ink-faint">
            Display name (optional)
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="name" maxLength={60} className="mt-1" />
          </label>
          <label className="block text-xs text-ink-faint">
            Choose a password or a passphrase (at least 12 characters)
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className="mt-1" />
          </label>
          <label className="block text-xs text-ink-faint">
            The password again
            <Input type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" className="mt-1" />
          </label>
          {offerLock && (
            <fieldset className="space-y-2">
              <legend className="text-xs text-ink-faint mb-1">Lock your writing?</legend>
              <label className="flex items-start gap-2 text-sm text-ink-soft">
                <input type="radio" name="setup-lock" className="mt-1" checked={lock} onChange={() => setLock(true)} />
                <span>Lock it with this password. Best on a flash drive or a computer other people use. If you forget the password and lose your recovery codes, nobody can get your writing back.</span>
              </label>
              <label className="flex items-start gap-2 text-sm text-ink-soft">
                <input type="radio" name="setup-lock" className="mt-1" checked={!lock} onChange={() => setLock(false)} />
                <span>Don&rsquo;t lock it. Simpler. Anyone who can open the data folder can read what you wrote.</span>
              </label>
              <p className="text-xs text-ink-ghost">You can change this later in Settings.</p>
            </fieldset>
          )}
          {computerFolder && (
            <fieldset className="space-y-2">
              <legend className="text-xs text-ink-faint mb-1">Where should your writing be kept?</legend>
              <label className="flex items-start gap-2 text-sm text-ink-soft">
                <input type="radio" name="setup-place" className="mt-1" checked={!onComputer} onChange={() => setOnComputer(false)} />
                <span>On this drive, beside the app. Nothing of yours is left on this computer, and you can carry it with you.</span>
              </label>
              <label className="flex items-start gap-2 text-sm text-ink-soft">
                <input type="radio" name="setup-place" className="mt-1" checked={onComputer} onChange={() => setOnComputer(true)} />
                <span>On this computer, in <span className="break-all">{computerFolder}</span>. This leaves a folder on this computer on purpose, and the drive holds only the app: your writing opens only when the drive is in this computer.</span>
              </label>
            </fieldset>
          )}
          <p className="text-xs text-ink-ghost">
            There is no owner to reset it for you. If you forget it, a recovery code is the only way back in{offerLock && lock ? ": you will be shown your recovery codes next" : "; you can make recovery codes in Settings after you sign in"}. Before you start you will be shown a short page about your writing.
          </p>
          {error && <ErrorNote>{error}</ErrorNote>}
          <Button type="submit" disabled={busy || !username.trim() || !password || !again} className="w-full">
            {busy ? "Setting up…" : "Set up"}
          </Button>
        </form>
      </div>
    </div>
  );
}
