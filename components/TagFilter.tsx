"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { Tag } from "./TagManager";

interface Props {
  userTags: Tag[];
  selectedTagId: number | null;
}

export default function TagFilter({ userTags, selectedTagId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    if (e.target.value) {
      params.set("tag_id", e.target.value);
    } else {
      params.delete("tag_id");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  if (userTags.length === 0) return null;

  return (
    <select
      value={selectedTagId ?? ""}
      onChange={handleChange}
      className="text-xs bg-surface border border-line-strong text-ink-muted rounded-lg px-2 py-1.5 focus:border-focus outline-none"
      aria-label="Filter by tag"
    >
      <option value="">All readings</option>
      {userTags.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );
}
