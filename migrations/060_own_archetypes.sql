-- A person's own archetypes, their own concepts, and their own links from any piece of any ritual set to either.
-- These are PRIVATE and PER PERSON. They never edit the shared archetypes, concepts or symbol links (migrations 033, 007
-- and 059); they sit beside them and are always shown apart, labelled as the person's own. Plain text only.
--
-- 1. user_archetypes: a pattern the person names themselves (name, a sentence about it, its good side and its hard side).
-- 2. user_concepts: a smaller idea of their own, with a description. It may sit under one shared archetype or one of the
--    person's own (never both). If that archetype is later deleted the concept stays, with no archetype.
-- 3. user_symbol_links: "this piece reaches that archetype or concept". The piece is a shared piece, by its text id
--    ('rune-fehu', 'ogham-beith', 'major-0', 'die-d6-3'), or one of the person's own oracle items (oracle_card_id, which
--    is removed with the item). The target is one shared archetype, one of the person's own archetypes, or one of their
--    own concepts. Deleting a target removes the links to it. aspect says which side of it the link names.
--
-- Everything cascades when the account is deleted. Limits on how many a person may keep are checked in the routes
-- (lib code), not here. Nothing is removed or renamed. Idempotent.

CREATE TABLE IF NOT EXISTS user_archetypes (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT    NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  -- A group heading of the person's own choosing, or nothing.
  realm      TEXT    CHECK (realm IS NULL OR char_length(realm) BETWEEN 1 AND 80),
  summary    TEXT    NOT NULL DEFAULT '' CHECK (char_length(summary) <= 600),
  light      TEXT    NOT NULL DEFAULT '' CHECK (char_length(light) <= 600),
  shadow     TEXT    NOT NULL DEFAULT '' CHECK (char_length(shadow) <= 600),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS user_archetypes_name ON user_archetypes(user_id, lower(name));

CREATE TABLE IF NOT EXISTS user_concepts (
  id                 SERIAL PRIMARY KEY,
  user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name               TEXT    NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  description        TEXT    NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
  shared_archetype_id INTEGER REFERENCES archetypes(id) ON DELETE SET NULL,
  user_archetype_id   INTEGER REFERENCES user_archetypes(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (shared_archetype_id IS NULL OR user_archetype_id IS NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS user_concepts_name ON user_concepts(user_id, lower(name));

CREATE TABLE IF NOT EXISTS user_symbol_links (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- The piece: a shared piece by id, or one of the person's own oracle items.
  symbol_id         TEXT    CHECK (symbol_id IS NULL OR char_length(symbol_id) BETWEEN 1 AND 80),
  oracle_card_id    INTEGER REFERENCES oracle_cards(id) ON DELETE CASCADE,
  -- The target: exactly one of these.
  archetype_id      INTEGER REFERENCES archetypes(id) ON DELETE CASCADE,
  user_archetype_id INTEGER REFERENCES user_archetypes(id) ON DELETE CASCADE,
  user_concept_id   INTEGER REFERENCES user_concepts(id) ON DELETE CASCADE,
  aspect            TEXT    NOT NULL DEFAULT 'neutral' CHECK (aspect IN ('light', 'shadow', 'neutral')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (num_nonnulls(symbol_id, oracle_card_id) = 1),
  CHECK (num_nonnulls(archetype_id, user_archetype_id, user_concept_id) = 1)
);

-- One link per person, piece and target.
CREATE UNIQUE INDEX IF NOT EXISTS user_symbol_links_shared_piece
  ON user_symbol_links(user_id, symbol_id, COALESCE(archetype_id, 0), COALESCE(user_archetype_id, 0), COALESCE(user_concept_id, 0))
  WHERE symbol_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS user_symbol_links_oracle_piece
  ON user_symbol_links(user_id, oracle_card_id, COALESCE(archetype_id, 0), COALESCE(user_archetype_id, 0), COALESCE(user_concept_id, 0))
  WHERE oracle_card_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS user_symbol_links_user_symbol ON user_symbol_links(user_id, symbol_id);
CREATE INDEX IF NOT EXISTS user_symbol_links_user_oracle ON user_symbol_links(user_id, oracle_card_id);
CREATE INDEX IF NOT EXISTS user_symbol_links_user_archetype ON user_symbol_links(user_archetype_id);
CREATE INDEX IF NOT EXISTS user_symbol_links_user_concept ON user_symbol_links(user_concept_id);
