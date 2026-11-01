"use client";

import { useId, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Select, Textarea } from "@/components/ui/Field";
import { ErrorNote } from "@/components/ui/Page";
import { KINDS, KIND_LABELS, MAX_MESSAGE, type FeedbackKind } from "@/lib/feedback-shared";

/** A note to the person who runs the app. It can say which page it was sent from and what device, if the sender agrees. */
export default function FeedbackForm({ onSent, onCancel }: { onSent?: () => void; onCancel?: () => void }) {
  const uid = useId();
  const pathname = usePathname();
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [message, setMessage] = useState("");
  const [withPage, setWithPage] = useState(true);
  const [withDevice, setWithDevice] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const device = withDevice ? `${navigator.userAgent} · screen ${window.innerWidth}×${window.innerHeight}` : null;
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, message, page: withPage ? pathname : null, device }),
      });
      if (!res.ok) {
        setError((await res.json().catch(() => null))?.error ?? "Could not send that. Try again.");
        return;
      }
      setSent(true);
      setMessage("");
      onSent?.();
    } catch {
      setError("Could not reach the app. Check your connection and try again. Your words are still here.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-3" role="status">
        <p className="text-sm text-ink-soft">Sent. Thank you. You can see it, and any reply, under Feedback in the navigation.</p>
        <div className="flex gap-2">
          <Button onClick={() => setSent(false)} variant="quiet">Send another</Button>
          {onCancel && <Button onClick={onCancel} variant="primary">Close</Button>}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={send} className="space-y-3">
      <Field htmlFor={`${uid}-kind`} label="What is it?">
        <Select id={`${uid}-kind`} value={kind} onChange={(e) => setKind(e.target.value as FeedbackKind)}>
          {KINDS.map((k) => (
            <option key={k} value={k}>{KIND_LABELS[k]}</option>
          ))}
        </Select>
      </Field>
      <Field
        htmlFor={`${uid}-message`}
        label="Tell me about it"
        hint="What you did, what you expected, what happened. The person who runs this app reads it. Please leave out private journal words."
      >
        <Textarea id={`${uid}-message`} value={message} rows={5} maxLength={MAX_MESSAGE} onChange={(e) => setMessage(e.target.value)} required />
      </Field>
      <label className="flex items-start gap-2 text-xs text-ink-muted cursor-pointer">
        <input type="checkbox" checked={withPage} onChange={(e) => setWithPage(e.target.checked)} className="accent-tone-600 mt-0.5" />
        <span>Include which page I am on ({pathname})</span>
      </label>
      <label className="flex items-start gap-2 text-xs text-ink-muted cursor-pointer">
        <input type="checkbox" checked={withDevice} onChange={(e) => setWithDevice(e.target.checked)} className="accent-tone-600 mt-0.5" />
        <span>Include my browser and screen size (helps find problems on phones)</span>
      </label>
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy || !message.trim()}>{busy ? "Sending…" : "Send"}</Button>
        {onCancel && <Button onClick={onCancel} variant="quiet">Cancel</Button>}
      </div>
    </form>
  );
}
