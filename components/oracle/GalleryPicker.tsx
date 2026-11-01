"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { filterByTag, tagCounts, type TagFilter } from "@/lib/gallery-tags-core";

interface Item {
  id: number;
  alt: string | null;
  version: string;
  tags?: string[];
}

/** The person's gallery as a row of pictures to choose from; pressing one puts a copy of it on the item. */
export default function GalleryPicker({
  busy,
  onChoose,
  onCancel,
}: {
  busy: boolean;
  onChoose: (galleryId: number) => void;
  onCancel: () => void;
}) {
  const uid = useId();
  const [items, setItems] = useState<Item[] | null>(null);
  const [failed, setFailed] = useState(false);
  // "all", "untagged", or "tag:<key>": which pictures to show.
  const [show, setShow] = useState("all");

  useEffect(() => {
    let live = true;
    fetch("/api/oracle/gallery")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((body) => live && setItems(body.items))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  const counts = tagCounts(items ?? []);
  const filter: TagFilter = show === "untagged" ? { kind: "untagged" } : show.startsWith("tag:") ? { kind: "tag", key: show.slice(4) } : { kind: "all" };
  const shown = filterByTag(items ?? [], filter);

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-soft">Choose a picture from your gallery. The gallery keeps its own copy.</p>
      {failed && <p className="text-xs text-danger" role="alert">Could not read your gallery. Try again in a moment.</p>}
      {!failed && items === null && <p className="text-xs text-ink-faint">Loading…</p>}
      {items && items.length === 0 && (
        <p className="text-xs text-ink-faint">
          Your gallery is empty. Pictures you make or keep go to the <Link href="/oracle/gallery" className="underline">gallery</Link>.
        </p>
      )}
      {items && counts.length > 0 && (
        <div>
          <label htmlFor={`${uid}-show`} className="block text-xs text-ink-faint mb-1">Show</label>
          <Select id={`${uid}-show`} value={show} onChange={(e) => setShow(e.target.value)} className="max-w-xs">
            <option value="all">All pictures ({items.length})</option>
            <option value="untagged">Pictures with no tags</option>
            {counts.map((c) => <option key={c.key} value={`tag:${c.key}`}>{c.label} ({c.n})</option>)}
          </Select>
        </div>
      )}
      {items && items.length > 0 && shown.length === 0 && <p className="text-xs text-ink-faint">No picture has that tag.</p>}
      {items && items.length > 0 && (
        <ul className="flex flex-wrap gap-2 list-none p-0 m-0">
          {shown.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => onChoose(item.id)}
                className="block rounded-md border border-line-strong hover:border-line-hover focus-visible:outline focus-visible:outline-2 p-0 overflow-hidden"
                aria-label={item.alt ? `Use this picture: ${item.alt}` : "Use this picture"}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/oracle/gallery/${item.id}?v=${item.version}&s=thumb`}
                  alt={item.alt ?? ""}
                  loading="lazy"
                  onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
                  className="h-24 w-auto min-w-16 object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={onCancel} className={buttonClass.quiet}>
        Cancel
      </button>
    </div>
  );
}
