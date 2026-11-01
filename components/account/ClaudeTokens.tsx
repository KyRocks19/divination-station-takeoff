"use client";

import { FEATHERED } from "@/lib/edition";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { parseDate } from "@/lib/date";
import { MAX_PERSONAL_TOKENS, MAX_TOKEN_NAME, type PersonalTokenRow } from "@/lib/claude-tokens-core";

const when = (s: string) => parseDate(s).toLocaleString();

/**
 * Settings: a person's own tokens for the Claude tool routes. Each token acts for this account and nothing else. It is shown once,
 * only its hash is kept, and it can be revoked here at any time.
 */
function ClaudeTokensInner() {
  const [tokens, setTokens] = useState<PersonalTokenRow[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<{ name: string; token: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/settings/claude-tokens").catch(() => null);
    if (res?.ok) setTokens(await res.json());
    else setUnavailable(true);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function make(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFresh(null);
    setCopied(false);
    const res = await fetch("/api/settings/claude-tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).catch(() => null);
    const body = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) return setError(body?.error ?? "That could not be done. Try again.");
    setFresh({ name: name.trim(), token: body.token });
    setName("");
    load();
  }

  async function revoke(t: PersonalTokenRow) {
    if (!confirm(`Revoke the token "${t.name}"? Whatever uses it stops working at once.`)) return;
    await fetch(`/api/settings/claude-tokens/${t.id}`, { method: "DELETE" }).catch(() => null);
    if (fresh?.name === t.name) setFresh(null);
    load();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(fresh!.token);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card className="space-y-3" role="region" aria-labelledby="claude-tokens-title">
      <div>
        <h3 id="claude-tokens-title" className="font-semibold text-ink-strong">Claude Code Integration</h3>
        <p className="text-xs text-ink-faint mt-0.5">
          A token lets a program such as Claude Code read and add to <em>your</em> readings and journals through this app&rsquo;s tool routes. It works for
          your account only. Make one for each thing that will use it, so you can stop one without stopping the others.
        </p>
      </div>

      {unavailable ? (
        <p className="text-xs text-ink-ghost">Tokens are not available on this copy of the app yet.</p>
      ) : (
        <>
          {fresh && (
            <div className="rounded-control border border-line-strong p-3 space-y-2" role="group" aria-label="Your new token">
              <p className="text-xs text-warning-ink">Copy this token now. It is not shown again. It is called &ldquo;{fresh.name}&rdquo;.</p>
              <code className="block break-all text-xs text-ink-strong font-mono select-all">{fresh.token}</code>
              <Button variant="quiet" onClick={copy}>{copied ? "Copied" : "Copy the token"}</Button>
            </div>
          )}

          {tokens && tokens.length > 0 && (
            <ul className="space-y-2">
              {tokens.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    <span className="text-ink-strong break-words">{t.name}</span>
                    <span className="block text-xs text-ink-faint">
                      Made {when(t.created_at)}. {t.last_used_at ? `Last used ${when(t.last_used_at)}.` : "Not used yet."}
                    </span>
                  </span>
                  <Button variant="danger" onClick={() => revoke(t)} aria-label={`Revoke the token ${t.name}`}>Revoke</Button>
                </li>
              ))}
            </ul>
          )}
          {tokens && tokens.length === 0 && !fresh && <p className="text-xs text-ink-ghost">You have no tokens yet.</p>}

          <form onSubmit={make} className="space-y-2">
            <Field htmlFor="claude-token-name" label="Name for a new token" hint={`For example "Claude Code on my laptop". Up to ${MAX_PERSONAL_TOKENS} tokens at a time.`} error={error}>
              <Input id="claude-token-name" value={name} maxLength={MAX_TOKEN_NAME} onChange={(e) => setName(e.target.value)} autoComplete="off" />
            </Field>
            <Button type="submit" disabled={busy || !name.trim() || (tokens?.length ?? 0) >= MAX_PERSONAL_TOKENS}>{busy ? "Making…" : "Make a token"}</Button>
          </form>

          <div className="space-y-1 pt-1">
            <p className="text-xs text-ink-faint uppercase tracking-widest">How to use it</p>
            <p className="text-xs text-ink-muted">
              Send it in the header <code className="text-tone-300">X-Claude-Key: dsc_…</code> (or <code className="text-tone-300">Authorization: Bearer dsc_…</code>) to:
            </p>
            <ul className="text-xs text-ink-muted space-y-1 font-mono">
              <li>GET  /api/claude/readings</li>
              <li>POST /api/claude/readings</li>
              <li>GET  /api/claude/readings/[id]</li>
              <li>POST /api/claude/journals</li>
              <li>GET  /api/claude/journals</li>
            </ul>
          </div>
        </>
      )}
    </Card>
  );
}

/** Not in the Feathered edition, which has no AI (docs/plan-feathered-edition.md). */
export default function ClaudeTokens() {
  return FEATHERED ? null : <ClaudeTokensInner />;
}
