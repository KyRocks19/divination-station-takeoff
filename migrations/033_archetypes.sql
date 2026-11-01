-- Root archetypal concepts: the shared language that tarot concepts (and, in code, every other tool's symbols)
-- are matched to. See lib/archetypes-data.ts for what each archetype means and data/concept-archetypes-*.txt for
-- how the 2,059 tarot concepts were sorted.
--
-- 1. archetypes: the roots. Their words (summary, light side, shadow side) are stock text, kept in the database
--    only so the app can join to them; the source of truth is lib/archetypes-data.ts and scripts/seed-archetypes.ts
--    re-writes these rows from it.
-- 2. concept_archetypes: a tarot concept sits under one primary archetype and can sit under more (is_primary says
--    which). aspect says which side of the archetype the concept names: light, shadow, or neutral. A concept's own row
--    in `concepts`, its card links, and people's notes on it are not changed.
--
-- Nothing is removed or renamed. Idempotent.

CREATE TABLE IF NOT EXISTS archetypes (
  id         SERIAL PRIMARY KEY,
  slug       TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  realm      TEXT NOT NULL,
  summary    TEXT NOT NULL,
  light      TEXT NOT NULL,
  shadow     TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS concept_archetypes (
  concept_id   INTEGER NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  archetype_id INTEGER NOT NULL REFERENCES archetypes(id) ON DELETE CASCADE,
  aspect       TEXT    NOT NULL DEFAULT 'light' CHECK (aspect IN ('light', 'shadow', 'neutral')),
  is_primary   BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (concept_id, archetype_id)
);

CREATE INDEX IF NOT EXISTS concept_archetypes_archetype_id ON concept_archetypes(archetype_id);
-- At most one primary archetype per concept.
CREATE UNIQUE INDEX IF NOT EXISTS concept_archetypes_one_primary ON concept_archetypes(concept_id) WHERE is_primary;
