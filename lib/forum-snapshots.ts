// What a forum post keeps of a journal entry or a synthesis when it is posted, so editing or deleting the original later
// does not change what other people read (readings have been kept this way from the start). Pure functions; no imports.

/** The reading a journal entry belongs to, as much of it as the post shows. */
export interface JournalReadingRef {
  id: number;
  title: string | null;
  spread_name: string | null;
}

/** The fields of a journal entry that a post shows. Nothing else of the row is kept. */
export function journalSnapshot(
  journal: { author: string; content: string; card_index?: number | null; clarifier_index?: number | null; created_at: string | Date },
  reading: JournalReadingRef | null
): string {
  return JSON.stringify({
    author: journal.author,
    content: journal.content,
    card_index: journal.card_index ?? null,
    clarifier_index: journal.clarifier_index ?? null,
    created_at: journal.created_at instanceof Date ? journal.created_at.toISOString() : journal.created_at,
    reading: reading ? { id: reading.id, title: reading.title ?? null, spread_name: reading.spread_name ?? null } : null,
  });
}

/** The fields of a synthesis journal that a post shows (not the ids of the readings it was made from). */
export function synthesisSnapshot(sj: { prompt: string; content: string; created_at: string | Date }): string {
  return JSON.stringify({
    prompt: sj.prompt,
    content: sj.content,
    created_at: sj.created_at instanceof Date ? sj.created_at.toISOString() : sj.created_at,
  });
}

/** The frozen copy, or null when the post has none (an older post) or the stored text cannot be read. */
export function readSnapshot(snapshot: unknown): Record<string, unknown> | null {
  if (typeof snapshot !== "string" || !snapshot) return null;
  try {
    const v = JSON.parse(snapshot);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
