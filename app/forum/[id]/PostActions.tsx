"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  postId: number;
  canEdit: boolean;
  /** The leader of the post's circle may remove it without editing it. */
  canRemove?: boolean;
}

export default function ForumPostActions({ postId, canEdit, canRemove = false }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    await fetch(`/api/forum/${postId}`, { method: "DELETE" });
    router.push("/forum");
  }

  if (!canEdit && !canRemove) return null;

  return (
    <div className="flex items-center gap-3 text-sm">
      {canEdit && (
        <Link
          href={`/forum/${postId}/edit`}
          className="text-tone-500 hover:text-tone-300 transition-colors"
        >
          Edit post
        </Link>
      )}
      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="text-ink-ghost hover:text-danger-ink transition-colors"
        >
          Delete
        </button>
      ) : (
        <span className="flex items-center gap-2">
          <span className="text-ink-faint text-xs">Delete this post?</span>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-danger-ink hover:text-danger-soft disabled:opacity-40 transition-colors text-xs"
          >
            {deleting ? "Deleting…" : "Yes, delete"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="text-ink-ghost hover:text-ink-muted transition-colors text-xs"
          >
            Cancel
          </button>
        </span>
      )}
    </div>
  );
}
