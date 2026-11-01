// Admins' notes on sources (migration 097), in the database. Server code only. The notes are shared: everyone signed in to
// the copy reads them, and only an admin writes them. They hold no one's private writing and are not read by the companion.

import { query } from "./db";

/** Every note, by source id. */
export async function getSourceNotes(): Promise<Map<string, string>> {
  const rows = await query<{ source_id: string; note: string }>("SELECT source_id, note FROM source_notes");
  return new Map(rows.map((r) => [r.source_id, r.note]));
}

/** Saves or replaces the note on one source; an empty note removes it. */
export async function setSourceNote(sourceId: string, note: string, adminId: number): Promise<void> {
  if (note === "") {
    await query("DELETE FROM source_notes WHERE source_id = $1", [sourceId]);
  } else {
    await query(
      `INSERT INTO source_notes (source_id, note, updated_by, updated_at) VALUES ($1, $2, $3, now())
       ON CONFLICT (source_id) DO UPDATE SET note = EXCLUDED.note, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [sourceId, note, adminId]
    );
  }
}
