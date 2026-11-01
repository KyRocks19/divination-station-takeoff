"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { ErrorNote } from "@/components/ui/Page";
import AppSigil from "@/components/ui/AppSigil";

/** Choosing a new password with a username and a recovery code (made earlier in Settings). */
export default function RecoverForm() {
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== again) return setError("The two passwords are different.");
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/recover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.trim(), code, newPassword: password }),
    }).catch(() => null);
    const body = await res?.json().catch(() => ({}));
    if (res?.ok) {
      setDone(true);
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
          <p className="text-ink-faint mt-2 text-sm">Choose a new password with a recovery code</p>
        </div>
        {done ? (
          <div className="space-y-4 text-center" role="status">
            <p className="text-sm text-ink-soft">Your password is changed, and every device was signed out. That code is used up.</p>
            <a href="/login" className="inline-flex items-center min-h-11 text-sm underline text-accent-ink hover:text-accent-ink-hover">Go to sign in</a>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <label className="block text-xs text-ink-faint">
              Username
              <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" maxLength={100} className="mt-1" />
            </label>
            <label className="block text-xs text-ink-faint">
              One recovery code
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXX-XXXX-XXXX" autoComplete="off" autoCapitalize="characters" spellCheck={false} className="mt-1 font-mono tracking-wider" />
            </label>
            <label className="block text-xs text-ink-faint">
              New password (at least 12 characters)
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className="mt-1" />
            </label>
            <label className="block text-xs text-ink-faint">
              The same password again
              <Input type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" className="mt-1" />
            </label>
            {error && <ErrorNote className="text-center text-sm">{error}</ErrorNote>}
            <Button type="submit" className="w-full py-3" disabled={busy || !username.trim() || !code.trim() || !password || !again}>
              {busy ? "Changing…" : "Change my password"}
            </Button>
            <p className="text-center text-xs text-ink-ghost">
              No codes? Ask the person who runs this app to reset your password. <a href="/login" className="underline hover:text-ink-soft">Back to sign in</a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
