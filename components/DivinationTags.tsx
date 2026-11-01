"use client";

import { useEffect, useState } from "react";
import TagManager, { type Tag } from "@/components/TagManager";

/**
 * The tags on a reading with any tool but tarot (open item PAT1), in the same editor tarot readings use. It asks for the tags itself, so each tool's page
 * only names the reading. Where this copy of the app has no tags for these readings yet, it shows nothing at all rather than a broken control.
 */
export default function DivinationTags({ divinationId, className }: { divinationId: number; className?: string }) {
  const [tags, setTags] = useState<Tag[] | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/divinations/${divinationId}/tags`)
      .then((r) => (r.ok ? (r.json() as Promise<Tag[]>) : null))
      .then((t) => live && setTags(t))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [divinationId]);
  if (tags === null) return null;
  return <TagManager entityType="divination" entityId={divinationId} initialTags={tags} className={className} />;
}
