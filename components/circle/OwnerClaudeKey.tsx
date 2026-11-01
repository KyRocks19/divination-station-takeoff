"use client";

import { useState } from "react";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { parseDate } from "@/lib/date";
import { MAX_CLAUDE_CIRCLE_LIMIT, MAX_CLAUDE_MEMBER_LIMIT, type CircleView } from "@/lib/circles-core";

type Circle = NonNullable<CircleView["circle"]>;
type Act = (url: string, method: string, body: unknown, done: string | ((data: Record<string, unknown> | null) => string)) => Promise<boolean>;

/**
 * The circle owner's Claude key and the limits on it (open items C1 and C2). The key is typed once, goes to the server, and is never shown again:
 * this component only ever receives the last four characters.
 */
export default function OwnerClaudeKey({ circle, busy, act }: { circle: Circle; busy: boolean; act: Act }) {
  const c = circle.claude;
  const [key, setKey] = useState("");
  const [replacing, setReplacing] = useState(false);
  const [memberLimit, setMemberLimit] = useState(String(c.member_limit));
  const [circleLimit, setCircleLimit] = useState(String(c.circle_limit));
  const showForm = !c.has_key || replacing;

  async function saveKey(e: React.FormEvent) {
    e.preventDefault();
    const ok = await act(`/api/circles/${circle.id}/claude-key`, "PUT", { key }, (data) =>
      data?.checked === false
        ? "The key is saved, encrypted. Anthropic could not be reached to check it just now, so try a request to see that it works."
        : "The key is saved, encrypted. Anthropic accepted it."
    );
    if (ok) {
      setKey("");
      setReplacing(false);
    }
  }

  return (
    <section aria-labelledby="circle-claude" className="space-y-3 border border-line-faint rounded-control p-4">
      <h2 id="circle-claude" className="text-sm text-ink-muted font-medium">Your Claude key for this circle</h2>
      <p className="text-xs text-ink-faint">
        If you add a key, members who agreed use it when they ask Claude for help, and you pay for those requests, up to the limits below. The key is
        encrypted on the server and cannot be read back, not even by you. Remove it at any time and members go back to the app&apos;s own Claude.
      </p>
      {!c.can_store && (
        <p className="text-xs text-danger-ink" role="note">
          This copy of the app cannot store a key yet. The person who runs the app has to set <code>CIRCLE_KEY_SECRET</code> on the server first.
        </p>
      )}
      {c.has_key && (
        <p className="text-sm text-ink-soft">
          A key ending in <span className="font-mono">{c.last4}</span> is saved{c.set_at ? ` (added ${parseDate(c.set_at).toLocaleDateString()})` : ""}.
        </p>
      )}
      {showForm ? (
        <form onSubmit={saveKey} className="space-y-3">
          <Field htmlFor="circle-claude-key" label={c.has_key ? "New key" : "Anthropic API key"} hint="It starts with sk-ant-. Make one in your own Anthropic account, and give it a spending limit there.">
            <Input
              id="circle-claude-key"
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              maxLength={400}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy || !c.can_store || !key.trim()}>{busy ? "Saving…" : "Save the key"}</Button>
            {replacing && <Button variant="text" onClick={() => { setReplacing(false); setKey(""); }}>Cancel</Button>}
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="quiet" disabled={busy} onClick={() => setReplacing(true)}>Replace the key</Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => {
              if (!window.confirm("Remove the key? Members will use the app's own Claude again. You can add a key again later.")) return;
              act(`/api/circles/${circle.id}/claude-key`, "DELETE", undefined, "The key is removed.");
            }}
          >
            Remove the key
          </Button>
        </div>
      )}

      <form
        className="space-y-3 pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          act(`/api/circles/${circle.id}/claude-limits`, "PATCH", { member_limit: memberLimit, circle_limit: circleLimit }, "The limits are saved.");
        }}
      >
        <h3 className="text-xs text-ink-muted font-medium">Limits on your key (requests a day, from midnight)</h3>
        <div className="flex flex-wrap gap-4">
          <Field htmlFor="circle-member-limit" label="Each person" hint={`0 to ${MAX_CLAUDE_MEMBER_LIMIT}. 0 switches it off.`}>
            <Input id="circle-member-limit" type="number" inputMode="numeric" min={0} max={MAX_CLAUDE_MEMBER_LIMIT} wide={false} className="w-28" value={memberLimit} onChange={(e) => setMemberLimit(e.target.value)} />
          </Field>
          <Field htmlFor="circle-total-limit" label="The whole circle" hint={`0 to ${MAX_CLAUDE_CIRCLE_LIMIT}.`}>
            <Input id="circle-total-limit" type="number" inputMode="numeric" min={0} max={MAX_CLAUDE_CIRCLE_LIMIT} wide={false} className="w-28" value={circleLimit} onChange={(e) => setCircleLimit(e.target.value)} />
          </Field>
        </div>
        <Button type="submit" variant="quiet" disabled={busy}>Save the limits</Button>
        {c.used_today !== null && (
          <p className="text-xs text-ink-faint">Used through your key today: {c.used_today} of {c.circle_limit}.</p>
        )}
      </form>
    </section>
  );
}
