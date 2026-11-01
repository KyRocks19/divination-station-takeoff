"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { PageTitle } from "@/components/ui/Page";

interface Props {
  params: Promise<{ id: string }>;
}

export default function EditForumPostPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    fetch(`/api/forum/${id}`)
      .then((r) => {
        if (r.status === 403 || r.status === 401) { setForbidden(true); return null; }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        setTitle(data.title ?? "");
        setBody(data.body ?? "");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const canSubmit = title.trim().length > 0 && body.trim().length > 0 && !saving;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/forum/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to save");
        setSaving(false);
        return;
      }
      router.push(`/forum/${id}`);
    } catch {
      setError("Something went wrong");
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <p className="text-ink-faint text-sm">Loading…</p>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <p className="text-danger-ink text-sm">You don&apos;t have permission to edit this post.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <PageTitle>Edit Post</PageTitle>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="edit-title" className="block text-xs uppercase tracking-widest text-ink-faint">
            Title
          </label>
          <input
            id="edit-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            className="w-full bg-field border border-line-strong focus:border-focus rounded-lg px-3 py-2 text-ink-strong placeholder-ink-ghost text-sm outline-none transition-colors"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="edit-body" className="block text-xs uppercase tracking-widest text-ink-faint">
            Your thoughts
          </label>
          <textarea
            id="edit-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            className="w-full bg-field border border-line-strong focus:border-focus rounded-lg px-3 py-2 text-ink-strong placeholder-ink-ghost text-sm outline-none resize-none transition-colors"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-danger-ink bg-danger/5 border border-danger/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!canSubmit}
            className="bg-blush hover:bg-blush-soft disabled:opacity-40 disabled:cursor-not-allowed text-canvas text-sm font-medium px-5 py-2 min-h-11 sm:min-h-0 rounded-lg transition-colors"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/forum/${id}`)}
            className="text-sm text-ink-faint hover:text-ink-soft transition-colors px-3 py-2"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
