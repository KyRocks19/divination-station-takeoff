"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ErrorNote } from "@/components/ui/Page";

/** The owner's two choices for something that was reported: keep it up (shown again, reports closed) or delete it. */
export default function ReportQueueActions({ kind, id }: { kind: "post" | "comment"; id: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "keep" | "delete") {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/forum-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, [kind === "post" ? "post_id" : "comment_id"]: id }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError("That could not be done. It may already be gone.");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="quiet" disabled={busy} onClick={() => act("keep")}>Keep it up</Button>
        {confirmDelete ? (
          <>
            <Button variant="danger" disabled={busy} onClick={() => act("delete")}>Yes, delete it</Button>
            <Button variant="quiet" disabled={busy} onClick={() => setConfirmDelete(false)}>Cancel</Button>
          </>
        ) : (
          <Button variant="danger" disabled={busy} onClick={() => setConfirmDelete(true)}>Delete</Button>
        )}
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
    </div>
  );
}
