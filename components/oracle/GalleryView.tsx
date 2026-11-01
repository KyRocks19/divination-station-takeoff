"use client";

import { useId, useRef, useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import { fieldFullClass } from "@/components/ui/Field";
import { MADE_WITH_LABELS } from "@/lib/art-maker";
import { MAX_ALT_LENGTH, limitsFor } from "@/lib/oracle-art";
import { shrinkImage } from "@/lib/oracle-art-client";
import type { GalleryItem } from "@/lib/oracle-gallery";
import { MAX_TAGS_PER_PICTURE, cleanTags, filterByTag, tagCounts, tagsToText, tooManyTags, type TagFilter } from "@/lib/gallery-tags-core";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

/** One gallery picture; when its file cannot be reached (it lives on the owner's computer, which is off) a note stands in. */
function GalleryImage({ id, version, alt }: { id: number; version: string; alt: string | null }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="w-full h-56 rounded-md bg-surface-sunken flex items-center justify-center p-4 text-center text-xs text-ink-faint">
        This picture is stored on the owner&rsquo;s computer, which is not reachable right now.
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/oracle/gallery/${id}?v=${version}&s=thumb`}
      alt={alt ?? ""}
      loading="lazy"
      onError={() => setFailed(true)}
      className="w-full h-56 object-contain rounded-md bg-surface-sunken"
    />
  );
}

/** The person's gallery: add a picture of their own, describe it, or delete it. Every picture is private to them. */
export default function GalleryView({ initialItems, max, onDisk }: { initialItems: GalleryItem[]; max: number; onDisk: boolean }) {
  const uid = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState(initialItems);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [alts, setAlts] = useState<Record<number, string>>(() =>
    Object.fromEntries(initialItems.map((i) => [i.id, i.alt ?? ""]))
  );
  // The tags as the person is typing them, one line per picture, and which tag the list is narrowed to.
  const [tagTexts, setTagTexts] = useState<Record<number, string>>(() =>
    Object.fromEntries(initialItems.map((i) => [i.id, tagsToText(i.tags ?? [])]))
  );
  const [filter, setFilter] = useState<TagFilter>({ kind: "all" });

  async function reload() {
    const res = await fetch("/api/oracle/gallery");
    if (res.ok) {
      const body = await res.json();
      setItems(body.items);
      setAlts((a) => ({ ...Object.fromEntries(body.items.map((i: GalleryItem) => [i.id, i.alt ?? ""])), ...a }));
      setTagTexts((t) => ({ ...Object.fromEntries(body.items.map((i: GalleryItem) => [i.id, tagsToText(i.tags ?? [])])), ...t }));
    }
  }

  async function add(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setMessage({ ok: false, text: "Use a JPEG, PNG, or WebP picture. Other kinds, including SVG and GIF, are not accepted." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      let image: string;
      try {
        image = await shrinkImage(file, limitsFor(onDisk));
      } catch {
        throw new Error("That picture could not be read or made small enough. Try a different one.");
      }
      const res = await fetch("/api/oracle/gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const b = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof b?.error === "string" ? b.error : "Could not save the picture.");
      await reload();
      setMessage({ ok: true, text: "Picture added." });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Could not save the picture." });
    } finally {
      setBusy(false);
    }
  }

  async function saveAlt(item: GalleryItem) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/oracle/gallery/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alt: alts[item.id] ?? "" }),
      });
      if (!res.ok) throw new Error();
      setItems((list) => list.map((i) => (i.id === item.id ? { ...i, alt: (alts[item.id] ?? "").trim() || null } : i)));
      setMessage({ ok: true, text: "Description saved." });
    } catch {
      setMessage({ ok: false, text: "Could not save the description. Your text is still here; try again." });
    } finally {
      setBusy(false);
    }
  }

  async function saveTags(item: GalleryItem) {
    const text = tagTexts[item.id] ?? "";
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/oracle/gallery/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: text }),
      });
      const b = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof b?.error === "string" ? b.error : "");
      const tags: string[] = Array.isArray(b?.tags) ? b.tags : cleanTags(text);
      setItems((list) => list.map((i) => (i.id === item.id ? { ...i, tags } : i)));
      setTagTexts((t) => ({ ...t, [item.id]: tagsToText(tags) }));
      setMessage({
        ok: true,
        text: tooManyTags(text) ? `Tags saved. A picture holds ${MAX_TAGS_PER_PICTURE} tags, so the rest were left off.` : "Tags saved.",
      });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error && err.message ? err.message : "Could not save the tags. Your text is still here; try again." });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/oracle/gallery/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setItems((list) => list.filter((i) => i.id !== id));
      setConfirmDelete(null);
      setMessage({ ok: true, text: "Picture deleted. Any item that already uses a copy keeps it." });
    } catch {
      setMessage({ ok: false, text: "Could not delete the picture. Nothing was changed." });
    } finally {
      setBusy(false);
    }
  }

  const full = items.length >= max;
  const counts = tagCounts(items);
  const untagged = items.filter((i) => (i.tags ?? []).length === 0).length;
  // A filter on a tag that no picture has any more (it was just removed) shows everything again.
  const active: TagFilter = filter.kind === "tag" && !counts.some((c) => c.key === filter.key) ? { kind: "all" } : filter.kind === "untagged" && untagged === 0 ? { kind: "all" } : filter;
  const shown = filterByTag(items, active);
  const pressed = (f: TagFilter) => f.kind === active.kind && (f.kind !== "tag" || (active.kind === "tag" && f.key === active.key));
  const filterButton = (f: TagFilter, label: string, n: number) => (
    <button
      type="button"
      aria-pressed={pressed(f)}
      onClick={() => setFilter(f)}
      className={`${pressed(f) ? buttonClass.primary : buttonClass.quiet} min-h-6`}
    >
      {label} ({n})
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy || full} onClick={() => fileInput.current?.click()} className={buttonClass.primary}>
          Add a picture
        </button>
        <input ref={fileInput} type="file" accept={ACCEPTED.join(",")} onChange={add} className="sr-only" tabIndex={-1} aria-hidden="true" />
        <p className="text-xs text-ink-faint">
          {items.length} of {max} pictures{full ? ". The gallery is full; delete one to add another." : ""}
        </p>
      </div>

      {message && (
        <p className={`text-xs ${message.ok ? "text-ink-faint" : "text-danger"}`} role={message.ok ? "status" : "alert"}>
          {message.text}
        </p>
      )}

      {counts.length > 0 && (
        <div role="group" aria-label="Show pictures with a tag" className="flex flex-wrap items-center gap-2">
          {filterButton({ kind: "all" }, "All", items.length)}
          {untagged > 0 && filterButton({ kind: "untagged" }, "No tags", untagged)}
          {counts.map((c) => (
            <span key={c.key}>{filterButton({ kind: "tag", key: c.key }, c.label, c.n)}</span>
          ))}
        </div>
      )}
      <p role="status" className="text-xs text-ink-faint">
        {active.kind !== "all" && items.length > 0 ? `Showing ${shown.length} of ${items.length} pictures.` : ""}
      </p>

      {items.length === 0 ? (
        <p className="text-sm text-ink-ghost">
          Nothing here yet. Add a picture of your own, or make some on an item&rsquo;s page and keep the ones you like.
        </p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 list-none p-0 m-0">
          {shown.map((item) => (
            <li key={item.id} className="bg-surface border border-line rounded-card p-3 space-y-2">
              <GalleryImage id={item.id} version={item.version} alt={item.alt} />
              {item.made_with && MADE_WITH_LABELS[item.made_with] && (
                <p className="text-[11px] text-ink-ghost">{MADE_WITH_LABELS[item.made_with]}</p>
              )}
              {item.prompt && (
                <details className="text-[11px] text-ink-faint">
                  <summary className="cursor-pointer">The words it was made from</summary>
                  <p className="mt-1 break-words">{item.prompt}</p>
                </details>
              )}
              <div className="space-y-1">
                <label htmlFor={`${uid}-alt-${item.id}`} className="block text-xs text-ink-faint">Description (for a screen reader; optional)</label>
                <div className="flex gap-2">
                  <input
                    id={`${uid}-alt-${item.id}`}
                    value={alts[item.id] ?? ""}
                    maxLength={MAX_ALT_LENGTH}
                    onChange={(e) => setAlts((a) => ({ ...a, [item.id]: e.target.value }))}
                    autoComplete="off"
                    className={`${fieldFullClass} flex-1 min-w-0`}
                  />
                  <button
                    type="button"
                    disabled={busy || (alts[item.id] ?? "").trim() === (item.alt ?? "")}
                    onClick={() => saveAlt(item)}
                    className={buttonClass.quiet}
                  >
                    Save
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label htmlFor={`${uid}-tags-${item.id}`} className="block text-xs text-ink-faint">
                  Tags (your own words, separated by commas; up to {MAX_TAGS_PER_PICTURE})
                </label>
                <div className="flex gap-2">
                  <input
                    id={`${uid}-tags-${item.id}`}
                    value={tagTexts[item.id] ?? ""}
                    onChange={(e) => setTagTexts((t) => ({ ...t, [item.id]: e.target.value }))}
                    autoComplete="off"
                    className={`${fieldFullClass} flex-1 min-w-0`}
                  />
                  <button
                    type="button"
                    disabled={busy || cleanTags(tagTexts[item.id] ?? "").join("\n") === (item.tags ?? []).join("\n")}
                    onClick={() => saveTags(item)}
                    className={buttonClass.quiet}
                  >
                    Save tags
                  </button>
                </div>
              </div>
              <a href={`/api/oracle/gallery/${item.id}?download=1`} className={`${buttonClass.text} inline-flex items-center mr-3`}>
                Download<span className="sr-only"> picture {item.id}{item.alt ? `: ${item.alt}` : ""}</span>
              </a>
              {confirmDelete === item.id ? (
                <p className="text-xs text-ink-muted">
                  Delete this picture from the gallery? This cannot be undone.{" "}
                  <button type="button" onClick={() => remove(item.id)} disabled={busy} className="text-danger-ink hover:text-danger-soft">
                    Yes, delete it
                  </button>{" "}
                  <button type="button" onClick={() => setConfirmDelete(null)} className="text-ink-faint hover:text-ink-soft">Keep it</button>
                </p>
              ) : (
                <button type="button" disabled={busy} onClick={() => setConfirmDelete(item.id)} className={buttonClass.danger}>
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
