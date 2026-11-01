"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageTitle } from "@/components/ui/Page";

interface Reading {
  id: number;
  title: string | null;
  spread_name: string;
  created_at: string;
}

interface Journal {
  id: number;
  author: string;
  content: string;
  created_at: string;
  reading_id: number;
}

interface SynthesisJournal {
  id: number;
  prompt: string;
  content: string;
  created_at: string;
}

interface Attachment {
  type: "reading" | "journal" | "synthesis_journal";
  ref_id: number;
  label: string;
}

export default function NewForumPostPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const [readings, setReadings] = useState<Reading[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [synthJournals, setSynthJournals] = useState<SynthesisJournal[]>([]);

  const [showAttachPanel, setShowAttachPanel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/readings").then((r) => r.json()),
      fetch("/api/journals").then((r) => r.json()),
      fetch("/api/synthesis-journals").then((r) => r.json()),
    ]).then(([r, j, sj]) => {
      setReadings(Array.isArray(r) ? r : []);
      setJournals(Array.isArray(j) ? j : []);
      setSynthJournals(Array.isArray(sj) ? sj : []);
    });
  }, []);

  function addAttachment(att: Attachment) {
    if (attachments.some((a) => a.type === att.type && a.ref_id === att.ref_id)) return;
    setAttachments((prev) => [...prev, att]);
    setShowAttachPanel(false);
  }

  function removeAttachment(type: string, ref_id: number) {
    setAttachments((prev) => prev.filter((a) => !(a.type === type && a.ref_id === ref_id)));
  }

  const canSubmit = title.trim().length > 0 && body.trim().length > 0 && !saving;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/forum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          attachments: attachments.map(({ type, ref_id }) => ({ type, ref_id })),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to create post");
        setSaving(false);
        return;
      }
      const { id } = await res.json();
      router.push(`/forum/${id}`);
    } catch {
      setError("Something went wrong");
      setSaving(false);
    }
  }

  function readingLabel(r: Reading) {
    return (r.title || r.spread_name) + " · " + new Date(r.created_at.includes("T") ? r.created_at : r.created_at.replace(" ", "T") + "Z").toLocaleDateString();
  }

  function journalLabel(j: Journal) {
    const preview = j.content.slice(0, 60);
    return `[${j.author}] ${preview}${j.content.length > 60 ? "…" : ""}`;
  }

  function synthLabel(s: SynthesisJournal) {
    return s.prompt.slice(0, 70) + (s.prompt.length > 70 ? "…" : "");
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <PageTitle>New Post</PageTitle>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Title */}
        <div className="space-y-1.5">
          <label htmlFor="post-title" className="block text-xs uppercase tracking-widest text-ink-faint">
            Title
          </label>
          <input
            id="post-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give your post a title"
            maxLength={200}
            className="w-full bg-field border border-line-strong focus:border-focus rounded-lg px-3 py-2 text-ink-strong placeholder-ink-ghost text-sm outline-none transition-colors"
          />
        </div>

        {/* Body */}
        <div className="space-y-1.5">
          <label htmlFor="post-body" className="block text-xs uppercase tracking-widest text-ink-faint">
            Your thoughts
          </label>
          <textarea
            id="post-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share your reflection, context, or question…"
            rows={6}
            className="w-full bg-field border border-line-strong focus:border-focus rounded-lg px-3 py-2 text-ink-strong placeholder-ink-ghost text-sm outline-none resize-none transition-colors"
          />
        </div>

        {/* Attachments */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-ink-faint">Attachments (optional)</span>
            <button
              type="button"
              onClick={() => setShowAttachPanel((v) => !v)}
              className="max-sm:inline-flex max-sm:items-center max-sm:min-h-11 text-xs text-tone-400 hover:text-tone-300 transition-colors"
            >
              {showAttachPanel ? "Close" : "+ Add"}
            </button>
          </div>

          {/* Attached chips */}
          {attachments.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {attachments.map((a) => (
                <li
                  key={`${a.type}-${a.ref_id}`}
                  className="flex items-center gap-1.5 bg-tone-900/20 border border-line text-tone-300 text-xs rounded-full px-2.5 py-1"
                >
                  <span className="truncate max-w-[200px]">{a.label}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(a.type, a.ref_id)}
                    aria-label={`Remove ${a.label}`}
                    className="text-tone-500 hover:text-danger-ink transition-colors"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Attachment panel */}
          {showAttachPanel && (
            <div className="bg-field border border-line-strong rounded-xl p-4 space-y-4">
              {/* Readings */}
              {readings.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-widest text-ink-ghost mb-2">Readings</p>
                  <ul className="space-y-1">
                    {readings.map((r) => {
                      const label = readingLabel(r);
                      const already = attachments.some((a) => a.type === "reading" && a.ref_id === r.id);
                      return (
                        <li key={r.id}>
                          <button
                            type="button"
                            disabled={already}
                            onClick={() => addAttachment({ type: "reading", ref_id: r.id, label })}
                            className="w-full text-left text-sm text-ink-soft hover:text-tone-300 disabled:text-ink-ghost disabled:cursor-default transition-colors py-0.5"
                          >
                            {already ? "✓ " : ""}{label}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Journals */}
              {journals.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-widest text-ink-ghost mb-2">Journal Entries</p>
                  <ul className="space-y-1">
                    {journals.map((j) => {
                      const label = journalLabel(j);
                      const already = attachments.some((a) => a.type === "journal" && a.ref_id === j.id);
                      return (
                        <li key={j.id}>
                          <button
                            type="button"
                            disabled={already}
                            onClick={() => addAttachment({ type: "journal", ref_id: j.id, label })}
                            className="w-full text-left text-sm text-ink-soft hover:text-tone-300 disabled:text-ink-ghost disabled:cursor-default transition-colors py-0.5"
                          >
                            {already ? "✓ " : ""}{label}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Synthesis Journals */}
              {synthJournals.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-widest text-ink-ghost mb-2">Synthesis Journals</p>
                  <ul className="space-y-1">
                    {synthJournals.map((s) => {
                      const label = synthLabel(s);
                      const already = attachments.some((a) => a.type === "synthesis_journal" && a.ref_id === s.id);
                      return (
                        <li key={s.id}>
                          <button
                            type="button"
                            disabled={already}
                            onClick={() => addAttachment({ type: "synthesis_journal", ref_id: s.id, label })}
                            className="w-full text-left text-sm text-ink-soft hover:text-tone-300 disabled:text-ink-ghost disabled:cursor-default transition-colors py-0.5"
                          >
                            {already ? "✓ " : ""}{label}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {readings.length === 0 && journals.length === 0 && synthJournals.length === 0 && (
                <p className="text-sm text-ink-ghost">No readings or journals yet.</p>
              )}
            </div>
          )}
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
            {saving ? "Posting…" : "Post"}
          </button>
          <button
            type="button"
            onClick={() => history.back()}
            className="text-sm text-ink-faint hover:text-ink-soft transition-colors px-3 py-2 min-h-11 sm:min-h-0"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
