"use client";

import { useState } from "react";
import AddToDay from "@/components/AddToDay";
import { parseDate, toISOString } from "@/lib/date";
import ReportButton from "@/components/ReportButton";
import { shownAuthor } from "@/lib/forum-bundle-core";

interface Comment {
  id: number;
  post_id: number;
  user_id: number;
  content: string;
  created_at: string;
  username: string;
  display_name: string | null;
  /** The name this was written under on another host, when its author has no account here (migration 099). */
  origin_author?: string | null;
  /** Reported by enough people that it is hidden from most (its text is already replaced by a note for them). */
  hidden?: boolean;
}

interface Props {
  postId: number;
  initialComments: Comment[];
  currentUserId: number | null;
  isAdmin: boolean;
}

export default function ForumCommentThread({ postId, initialComments, currentUserId, isAdmin }: Props) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/forum/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to post comment");
        setSubmitting(false);
        return;
      }
      const newComment = await res.json();
      setComments((prev) => [...prev, newComment]);
      setContent("");
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(commentId: number) {
    setDeletingId(commentId);
    try {
      await fetch(`/api/forum/${postId}/comments/${commentId}`, { method: "DELETE" });
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {comments.length === 0 && (
        <p className="text-sm text-ink-ghost">No comments yet. Be the first to respond.</p>
      )}

      {comments.map((c) => {
        const authorName = shownAuthor(c);
        const canDelete = currentUserId === c.user_id || isAdmin;
        return (
          <div key={c.id} className="border-b border-line-faint pb-4 last:border-0">
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs text-tone-400">{authorName}</span>
                <span className="text-xs text-ink-ghost">
                  <time dateTime={toISOString(c.created_at)}>{parseDate(c.created_at).toLocaleDateString()}</time>
                </span>
                {c.hidden && <span className="text-xs text-warning-ink">Hidden from others while the owner looks at it</span>}
                {currentUserId && currentUserId !== c.user_id && !c.hidden && <ReportButton commentId={c.id} what="comment" />}
                {currentUserId && !c.hidden && <AddToDay kind="forum_comment" refId={c.id} />}
              </div>
              {canDelete && (
                <button
                  onClick={() => handleDelete(c.id)}
                  disabled={deletingId === c.id}
                  aria-label="Delete comment"
                  className="text-xs text-ink-ghost hover:text-danger-ink disabled:opacity-40 transition-colors"
                >
                  {deletingId === c.id ? "…" : "Delete"}
                </button>
              )}
            </div>
            <p className="text-sm text-ink-soft leading-relaxed whitespace-pre-wrap">{c.content}</p>
          </div>
        );
      })}

      {/* Comment form */}
      {currentUserId && (
        <form onSubmit={handleSubmit} className="space-y-2 pt-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Add a comment…"
            rows={3}
            className="w-full bg-field border border-line-strong focus:border-focus rounded-lg px-3 py-2 text-ink-strong placeholder-ink-ghost text-sm outline-none resize-none transition-colors"
          />
          {error && (
            <p role="alert" className="text-xs text-danger-ink">{error}</p>
          )}
          <button
            type="submit"
            disabled={!content.trim() || submitting}
            className="bg-tone-700/80 hover:bg-tone-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm px-4 py-1.5 rounded-lg transition-colors"
          >
            {submitting ? "Posting…" : "Comment"}
          </button>
        </form>
      )}
    </div>
  );
}
