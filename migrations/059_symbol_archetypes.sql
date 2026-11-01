-- Which archetypes each piece of a ritual set reaches, and what each link was drawn from.
-- A "symbol" is any piece the app already has an id for: a rune ('rune-fehu'), an ogham letter ('ogham-beith'), and in
-- later steps a tarot card ('major-0'), a die face, a coin side, a pendulum swing, a scrying surface. These are the
-- SHARED, stock links (like concept_archetypes for tarot concepts). A person's own links are a later migration and live
-- in their own tables; nothing here is ever per-person.
--
-- 1. symbol_archetypes: one row per link. is_primary marks a piece's first archetype (at most one per piece). aspect says
--    which side of the archetype the link names: light, shadow, or neutral (neutral is the word the database already
--    uses for "either"). basis says what the link was drawn from: poem, name, gloss, myth, folk, modern, app, and in
--    later steps smith-waite, numerology and similar. The allowed bases are kept in code (lib/symbol-archetype-map.ts),
--    not in a CHECK, so a new tool can add one without altering this table.
-- 2. symbol_notes: one short note per piece, for how the piece's links were reached and, where a piece deliberately has
--    no archetype (the five later ogham letters), why not. A piece with a note and no links is a decision, not a gap.
--
-- Nothing is removed or renamed. Idempotent. The rows are written by scripts/seed-symbol-archetypes.ts from
-- data/symbol-archetypes-*.txt; after that the database is the record (an admin page will edit it).

CREATE TABLE IF NOT EXISTS symbol_archetypes (
  symbol_id    TEXT    NOT NULL CHECK (char_length(symbol_id) BETWEEN 1 AND 80),
  archetype_id INTEGER NOT NULL REFERENCES archetypes(id) ON DELETE CASCADE,
  aspect       TEXT    NOT NULL DEFAULT 'neutral' CHECK (aspect IN ('light', 'shadow', 'neutral')),
  is_primary   BOOLEAN NOT NULL DEFAULT FALSE,
  basis        TEXT    NOT NULL CHECK (char_length(basis) BETWEEN 1 AND 40),
  -- The order the links were written in, strongest first; the primary link is 0.
  sort_order   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (symbol_id, archetype_id)
);

CREATE INDEX IF NOT EXISTS symbol_archetypes_archetype_id ON symbol_archetypes(archetype_id);
-- At most one primary archetype per piece.
CREATE UNIQUE INDEX IF NOT EXISTS symbol_archetypes_one_primary ON symbol_archetypes(symbol_id) WHERE is_primary;

CREATE TABLE IF NOT EXISTS symbol_notes (
  symbol_id TEXT PRIMARY KEY CHECK (char_length(symbol_id) BETWEEN 1 AND 80),
  note      TEXT NOT NULL CHECK (char_length(note) BETWEEN 1 AND 2000)
);
