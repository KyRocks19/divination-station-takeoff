// Tags for the picture gallery (open item P4): a few words the person puts on a picture so a big gallery can be sorted and found again. A tag is the
// person's own word; the app supplies none. This file has no imports, so the browser, the server and the tests use it; the database side is lib/oracle-gallery.ts.

export const MAX_TAGS_PER_PICTURE = 8;
export const MAX_TAG_LENGTH = 30;

/** What a tag filter can be: everything, the pictures with no tag, or one tag (its lower-case key). */
export type TagFilter = { kind: "all" } | { kind: "untagged" } | { kind: "tag"; key: string };

export const tagKey = (tag: string) => tag.toLowerCase();

const tidy = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Tags as sent or typed: a list, or one piece of text with the tags separated by commas or new lines. Each is tidied (spaces collapsed, cut to
 * MAX_TAG_LENGTH), blanks and repeats are dropped (repeats ignore capitals; the first spelling stays), and at most MAX_TAGS_PER_PICTURE are kept.
 */
export function cleanTags(value: unknown): string[] {
  const parts = Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : typeof value === "string" ? value.split(/[,\n;]/) : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const t = tidy(p).slice(0, MAX_TAG_LENGTH).trim();
    if (!t || seen.has(tagKey(t))) continue;
    seen.add(tagKey(t));
    out.push(t);
    if (out.length === MAX_TAGS_PER_PICTURE) break;
  }
  return out;
}

/** The tags as one line to edit: "moon, cups, 2026". */
export const tagsToText = (tags: readonly string[]) => tags.join(", ");

/** True when typed text holds more tags than a picture may have, so the screen can say that some were left out. */
export function tooManyTags(text: string): boolean {
  const all = text.split(/[,\n;]/).map(tidy).filter(Boolean);
  const distinct = new Set(all.map((t) => tagKey(t.slice(0, MAX_TAG_LENGTH))));
  return distinct.size > MAX_TAGS_PER_PICTURE;
}

export interface TagCount {
  key: string;
  /** The spelling shown: the one used most, the first seen when tied. */
  label: string;
  n: number;
}

/** Every tag in use over the pictures, with how many pictures carry it, A to Z. */
export function tagCounts(items: readonly { tags?: readonly string[] }[]): TagCount[] {
  const map = new Map<string, { spellings: Map<string, number>; n: number }>();
  for (const it of items) {
    for (const t of it.tags ?? []) {
      const e = map.get(tagKey(t)) ?? { spellings: new Map<string, number>(), n: 0 };
      e.n++;
      e.spellings.set(t, (e.spellings.get(t) ?? 0) + 1);
      map.set(tagKey(t), e);
    }
  }
  return [...map.entries()]
    .map(([key, e]) => ({ key, n: e.n, label: [...e.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0] }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
}

export function matchesFilter(tags: readonly string[] | undefined, f: TagFilter): boolean {
  const list = tags ?? [];
  if (f.kind === "all") return true;
  if (f.kind === "untagged") return list.length === 0;
  return list.some((t) => tagKey(t) === f.key);
}

export function filterByTag<T extends { tags?: readonly string[] }>(items: readonly T[], f: TagFilter): T[] {
  return items.filter((i) => matchesFilter(i.tags, f));
}

