"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { KIND_LABELS, STATUSES, type FeedbackKind, type FeedbackStatus } from "@/lib/feedback-shared";

interface Row {
  id: number;
  kind: FeedbackKind;
  message: string;
  page: string | null;
  device: string | null;
  status: FeedbackStatus;
  reply: string | null;
  created_at: string;
  username?: string;
}

const STATUS_WORDS: Record<FeedbackStatus, string> = { new: "New", seen: "Seen", done: "Done" };

/** A list of notes. "own" is the sender's view (their words and any reply); "admin" lets the owner mark and reply. */
export default function FeedbackList({ initial, mode }: { initial: Row[]; mode: "own" | "admin" }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [replying, setReplying] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function call(id: number, method: "PATCH" | "DELETE", body?: object) {
    setError(null);
    const res = await fetch(`/api/feedback/${id}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      setError((await res.json().catch(() => null))?.error ?? "That did not work. Try again.");
      return false;
    }
    router.refresh();
    return true;
  }

  async function setStatus(id: number, status: FeedbackStatus) {
    if (await call(id, "PATCH", { status })) setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  async function saveReply(id: number) {
    if (await call(id, "PATCH", { reply: draft })) {
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, reply: draft.trim() || null, status: r.status === "new" ? "seen" : r.status } : r)));
      setReplying(null);
    }
  }

  async function remove(id: number) {
    if (!confirm("Delete this note?")) return;
    if (await call(id, "DELETE")) setRows((rs) => rs.filter((r) => r.id !== id));
  }

  if (rows.length === 0) return <p className="text-sm text-ink-faint">{mode === "own" ? "Nothing sent yet." : "No notes yet."}</p>;

  return (
    <div className="space-y-3">
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      <ul className="list-none p-0 m-0 space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="bg-surface border border-line rounded-card p-4 space-y-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
              <span className="text-ink-soft">{KIND_LABELS[r.kind]}</span>
              {mode === "admin" && r.username && <span>from {r.username}</span>}
              <span>{new Date(r.created_at).toLocaleString()}</span>
              <span className={r.status === "new" ? "text-warning-ink" : r.status === "done" ? "text-success-ink" : ""}>{STATUS_WORDS[r.status]}</span>
            </div>
            <p className="text-sm text-ink whitespace-pre-wrap break-words">{r.message}</p>
            {(r.page || r.device) && (
              <p className="text-[11px] text-ink-ghost break-words">
                {r.page && <>Page: {r.page}. </>}
                {r.device && <>Device: {r.device}</>}
              </p>
            )}
            {r.reply && replying !== r.id && (
              <p className="text-sm text-ink-soft border-l-2 border-line-strong pl-3 whitespace-pre-wrap break-words">
                <span className="block text-[11px] text-ink-faint">Reply</span>
                {r.reply}
              </p>
            )}
            {replying === r.id && (
              <div className="space-y-2">
                <Textarea value={draft} rows={3} maxLength={2000} onChange={(e) => setDraft(e.target.value)} aria-label="Your reply" />
                <div className="flex gap-2">
                  <Button onClick={() => saveReply(r.id)}>Save reply</Button>
                  <Button variant="quiet" onClick={() => setReplying(null)}>Cancel</Button>
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              {mode === "admin" && (
                <>
                  {STATUSES.filter((s) => s !== r.status).map((s) => (
                    <Button key={s} variant="text" onClick={() => setStatus(r.id, s)}>Mark {STATUS_WORDS[s].toLowerCase()}</Button>
                  ))}
                  {replying !== r.id && (
                    <Button variant="text" onClick={() => { setReplying(r.id); setDraft(r.reply ?? ""); }}>{r.reply ? "Change reply" : "Reply"}</Button>
                  )}
                </>
              )}
              <Button variant="danger" onClick={() => remove(r.id)}>Delete</Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
