"use client";

import { useState, useRef, useEffect } from "react";
import { styleRef } from "@/lib/apply-style";

export interface Tag { id: number; name: string; color: string; }

const PRESET_COLORS = [
  "#7c3aed", "#1d4ed8", "#047857", "#b45309",
  "#be123c", "#0e7490", "#6d28d9", "#4b5563",
];

interface Props {
  /** "divination" is a reading with any tool but tarot (/api/divinations/[id]/tags). */
  entityType: "reading" | "journal" | "card" | "divination";
  entityId: string | number;
  initialTags: Tag[];
  className?: string;
}

export default function TagManager({ entityType, entityId, initialTags, className = "" }: Props) {
  const [tags, setTags] = useState<Tag[]>(initialTags);
  const [adding, setAdding] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [allTags, setAllTags] = useState<Tag[] | null>(null);
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!adding) return;
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setAdding(false);
        setInputValue("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [adding]);

  useEffect(() => {
    if (adding && allTags === null) {
      fetch("/api/tags").then((r) => r.json()).then(setAllTags).catch(() => setAllTags([]));
    }
  }, [adding, allTags]);

  const apiPath =
    entityType === "card"
      ? `/api/cards/${encodeURIComponent(entityId)}/tags`
      : `/api/${entityType}s/${entityId}/tags`;

  async function addExistingTag(tag: Tag) {
    if (tags.some((t) => t.id === tag.id)) return;
    const res = await fetch(apiPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag_id: tag.id }),
    });
    if (!res.ok) return;
    setTags((prev) => [...prev, tag]);
    setAdding(false);
    setInputValue("");
  }

  async function createAndAdd() {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    const res = await fetch(apiPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed, color: newColor }),
    });
    if (!res.ok) return;
    const tag: Tag = await res.json();
    setTags((prev) => (prev.some((t) => t.id === tag.id) ? prev : [...prev, tag]));
    setAllTags((prev) => (prev ? [...prev.filter((t) => t.id !== tag.id), tag] : [tag]));
    setAdding(false);
    setInputValue("");
  }

  async function removeTag(tagId: number) {
    await fetch(apiPath, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag_id: tagId }),
    });
    setTags((prev) => prev.filter((t) => t.id !== tagId));
  }

  const filtered = (allTags ?? []).filter(
    (t) =>
      !tags.some((et) => et.id === t.id) &&
      t.name.toLowerCase().includes(inputValue.toLowerCase())
  );
  const showCreate =
    inputValue.trim() &&
    !filtered.some((t) => t.name.toLowerCase() === inputValue.trim().toLowerCase());

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {tags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 font-medium"
          ref={styleRef({
            backgroundColor: `${tag.color}22`,
            color: tag.color,
            border: `1px solid ${tag.color}55`,
          })}
        >
          {tag.name}
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeTag(tag.id); }}
            className="opacity-50 hover:opacity-100 leading-none"
            aria-label={`Remove tag ${tag.name}`}
          >
            ×
          </button>
        </span>
      ))}

      <div className="relative" ref={dropRef}>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAdding((v) => !v); }}
          className="text-xs text-ink-ghost hover:text-tone-400 transition-colors px-1.5 py-0.5 min-h-11 sm:min-h-0 inline-flex items-center rounded border border-dashed border-line-strong hover:border-line-hover"
          aria-label="Add tag"
        >
          + tag
        </button>

        {adding && (
          <div className="absolute left-0 top-full mt-1 z-30 bg-surface border border-line-strong rounded-lg shadow-xl p-2 w-56 space-y-1.5">
            <input
              autoFocus
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (filtered[0]) addExistingTag(filtered[0]);
                  else if (showCreate) createAndAdd();
                }
                if (e.key === "Escape") { e.preventDefault(); setAdding(false); setInputValue(""); }
              }}
              placeholder="Search or create…"
              className="w-full bg-field border border-line-strong rounded px-2 py-1 text-xs text-ink-strong placeholder-ink-ghost focus:border-focus outline-none"
            />

            {allTags === null && (
              <p className="text-xs text-ink-ghost text-center py-1">Loading…</p>
            )}

            {filtered.length > 0 && (
              <ul className="space-y-0.5 max-h-28 overflow-y-auto">
                {filtered.map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={(e) => { e.preventDefault(); addExistingTag(t); }}
                      className="w-full text-left text-xs px-2 py-1 rounded hover:bg-tone-900/30 flex items-center gap-1.5"
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" ref={styleRef({ backgroundColor: t.color })} />
                      {t.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {showCreate && (
              <div className="space-y-1.5 border-t border-line pt-1.5">
                <div className="flex flex-wrap gap-1 px-1">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={(e) => { e.preventDefault(); setNewColor(c); }}
                      className={`w-4 h-4 rounded-full transition-transform ${newColor === c ? "ring-2 ring-white/70 scale-110" : "opacity-70 hover:opacity-100"}`}
                      ref={styleRef({ backgroundColor: c })}
                      aria-label={`Use color ${c}`}
                    />
                  ))}
                </div>
                <button
                  onClick={(e) => { e.preventDefault(); createAndAdd(); }}
                  className="w-full text-xs text-left bg-tone-800/30 hover:bg-tone-700/40 text-tone-200 rounded px-2 py-1 transition-colors flex items-center gap-1.5"
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" ref={styleRef({ backgroundColor: newColor })} />
                  Create &ldquo;{inputValue.trim()}&rdquo;
                </button>
              </div>
            )}

            {allTags !== null && filtered.length === 0 && !showCreate && (
              <p className="text-xs text-ink-ghost text-center py-1">No tags yet</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
