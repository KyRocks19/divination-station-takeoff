-- An admin's own note on a source (a primary or secondary source, or a source card on a tool's Sources page), shown to everyone on that copy (owner's request, 2026-10-26).
-- One note per source; the sources themselves stay in code (lib/sources.ts, lib/primary-sources.ts). Deleting the admin's account keeps the note and clears who wrote it.
CREATE TABLE IF NOT EXISTS source_notes (
  source_id   TEXT PRIMARY KEY,
  note        TEXT NOT NULL,
  updated_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
