"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { ErrorNote } from "@/components/ui/Page";

/**
 * "Report" under a forum post or comment: an optional reason and a Send button. The person is thanked and nothing more; they are never told
 * whether their report was the one that hid it. Not shown on a person's own writing.
 */
export default function ReportButton({ postId, commentId, what }: { postId?: number; commentId?: number; what: "post" | "comment" }) {
  const reasonId = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/forum/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post_id: postId, comment_id: commentId, reason }),
    }).catch(() => null);
    const body = await res?.json().catch(() => ({}));
    setBusy(false);
    if (res?.ok) return setDone("Thank you. The person who looks after this forum will look at it.");
    if (res?.status === 409) return setDone("You have already reported this.");
    setError(body?.error ?? "That could not be sent. Try again.");
  }

  if (done) return <p role="status" className="text-xs text-ink-faint">{done}</p>;
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-ink-ghost hover:text-ink-soft transition-colors">
        Report<span className="sr-only"> this {what}</span>
      </button>
    );
  }
  return (
    <div className="space-y-2 max-w-md">
      <label htmlFor={reasonId} className="block text-xs text-ink-faint">Why are you reporting this {what}? (optional)</label>
      <Textarea id={reasonId} rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex gap-2">
        <Button disabled={busy} onClick={send}>{busy ? "Sending…" : "Send report"}</Button>
        <Button variant="quiet" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}
