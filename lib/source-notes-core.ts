// The rules for an admin's note on a source (migration 097). Pure; the route, the editor and the tests share it.

import { PRIMARY_SOURCES, SECONDARY_SOURCES } from "./primary-sources";
import { SOURCES } from "./sources";

export const SOURCE_NOTE_MAX = 2000;

/** Every source a note can be written on: the primary and secondary sources, and the source cards on the tool pages. */
export function isNotableSource(id: unknown): id is string {
  if (typeof id !== "string") return false;
  return [...PRIMARY_SOURCES, ...SECONDARY_SOURCES, ...SOURCES].some((s) => s.id === id);
}

export type CleanNote = { ok: true; sourceId: string; note: string } | { ok: false; error: string };

/** Checks a request body { sourceId, note }. An empty note means "remove the note". */
export function cleanSourceNote(body: unknown): CleanNote {
  const b = (body ?? {}) as { sourceId?: unknown; note?: unknown };
  if (!isNotableSource(b.sourceId)) return { ok: false, error: "Not a source a note can be written on" };
  if (typeof b.note !== "string") return { ok: false, error: "The note must be text" };
  const note = b.note.replace(/\r\n/g, "\n").trim();
  if (note.length > SOURCE_NOTE_MAX) return { ok: false, error: `A note can be at most ${SOURCE_NOTE_MAX} characters` };
  return { ok: true, sourceId: b.sourceId, note };
}
