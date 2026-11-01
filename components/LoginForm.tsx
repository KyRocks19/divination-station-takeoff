"use client";

import { useEffect, useState } from "react";
import { FEATHERED } from "@/lib/edition";
import { useSearchParams } from "next/navigation";
import { browserSupportsWebAuthn, startAuthentication } from "@simplewebauthn/browser";
import AppSigil from "@/components/ui/AppSigil";

/** The sign-in form. `showJoin` is false on a local copy, which has no invite codes. */
export default function LoginForm({ showJoin }: { showJoin: boolean }) {
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [passkeys, setPasskeys] = useState(false);
  // The Feathered edition has no passkeys: one stays on the computer it was made on, and Feathered travels on a flash drive.
  useEffect(() => setPasskeys(!FEATHERED && browserSupportsWebAuthn()), []);

  // A full page load, not a client-side move: the navigation belongs to the root layout, which is drawn on the server from the session, and a
  // client-side move keeps the layout the signed-out page had (no navigation). Only a path on this site is followed; anything else goes home.
  async function enter(res: Response) {
    const from = params.get("from");
    const dest = from && from.startsWith("/") && !from.startsWith("//") ? from : "/";
    const body = await res.json().catch(() => ({}));
    window.location.assign(body.privacyNeeded ? `/welcome?from=${encodeURIComponent(dest)}` : dest);
  }

  // Passkey sign-in (S10): no username is typed; the device offers the passkeys it has for this site.
  async function withPasskey() {
    setLoading(true);
    setError("");
    try {
      const start = await fetch("/api/auth/login/passkey/options", { method: "POST" });
      const options = await start.json().catch(() => ({}));
      if (!start.ok) throw new Error(options.error);
      // The device's own error words (a cancel, a timeout) are not shown; the plain line below is.
      const response = await startAuthentication({ optionsJSON: options }).catch(() => {
        throw new Error("");
      });
      const res = await fetch("/api/auth/login/passkey", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ response }) });
      if (res.ok) return enter(res);
      throw new Error((await res.json().catch(() => ({}))).error);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "No passkey signed you in. Try again, or use your password.");
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const submittedUsername = String(form.get("username") ?? "").trim();
    const submittedPassword = String(form.get("password") ?? "");

    setUsername(submittedUsername);
    setPassword(submittedPassword);
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: submittedUsername, password: submittedPassword }),
      });
      if (res.ok) {
        await enter(res);
      } else {
        setError("That username and password do not match. Check both and try again.");
        setLoading(false);
      }
    } catch {
      setError("Could not reach the sign-in service. Try again in a moment.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <AppSigil className="h-20 w-20 mx-auto mb-4 text-tone-300" />
          <h1 className="text-3xl font-bold text-tone-300 tracking-widest">Divination Station</h1>
          <p className="text-ink-faint mt-2 text-sm">A private place for experimenting with randomness and the stories it produces. Divination is a tool that presents you with possibilities you might not have thought of yourself. Tarot, runes, ogham, the I Ching, geomancy, scrying, the pendulum, dice and coins, and your own writing, all can be used to get you out of your own head about your life situation and see it from different angles.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-username" className="block text-xs text-ink-faint mb-2">Username</label>
            <input
              id="login-username"
              name="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              required
              aria-describedby={error ? "login-error" : undefined}
              className="w-full bg-surface border border-line-strong rounded-lg px-4 py-3 text-ink-strong placeholder-ink-ghost focus:outline-none focus:border-focus transition-colors"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="block text-xs text-ink-faint mb-2">Password</label>
            <input
              id="login-password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              aria-describedby={error ? "login-error" : undefined}
              className="w-full bg-surface border border-line-strong rounded-lg px-4 py-3 text-ink-strong placeholder-ink-ghost focus:outline-none focus:border-focus transition-colors"
            />
          </div>
          {error && <p id="login-error" role="alert" className="text-danger-ink text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blush hover:bg-blush-soft disabled:opacity-40 disabled:cursor-not-allowed text-canvas font-semibold py-3 rounded-lg transition-colors"
          >
            {loading ? "Entering..." : "Enter"}
          </button>
        </form>
        {passkeys && (
          <button
            type="button"
            onClick={withPasskey}
            disabled={loading}
            className="w-full mt-3 border border-line-strong hover:border-focus disabled:opacity-40 text-ink-soft text-sm py-3 rounded-lg transition-colors"
          >
            Sign in with a passkey
          </button>
        )}
        <p className="text-center text-xs text-ink-ghost mt-6">
          {showJoin && (
            <>
              <a href="/join" className="underline hover:text-ink-soft">I have an invite code</a>
              {" · "}
            </>
          )}
          <a href="/recover" className="underline hover:text-ink-soft">I forgot my password</a>
          {" · "}
          <a href="/privacy" className="underline hover:text-ink-soft">Privacy and terms</a>
        </p>
      </div>
    </div>
  );
}
