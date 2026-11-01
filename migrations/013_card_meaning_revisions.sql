-- Keep every version of a user's own card meanings, so change over time can be shown.
-- card_customizations stays the current version; each save also adds a row here.

CREATE TABLE IF NOT EXISTS card_meaning_revisions (
  id                   SERIAL PRIMARY KEY,
  user_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id              TEXT NOT NULL,
  upright_keywords     TEXT,
  reversed_keywords    TEXT,
  upright_description  TEXT,
  reversed_description TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS card_meaning_revisions_user_card
  ON card_meaning_revisions(user_id, card_id, created_at DESC);

-- Existing customizations become the first recorded version (only where no history exists yet).
INSERT INTO card_meaning_revisions
  (user_id, card_id, upright_keywords, reversed_keywords, upright_description, reversed_description, created_at)
SELECT c.user_id, c.card_id, c.upright_keywords, c.reversed_keywords, c.upright_description, c.reversed_description, c.updated_at
FROM card_customizations c
WHERE NOT EXISTS (
  SELECT 1 FROM card_meaning_revisions r WHERE r.user_id = c.user_id AND r.card_id = c.card_id
);

-- card_customizations was created without ON DELETE CASCADE, which blocks deleting a user who has customizations.
ALTER TABLE card_customizations DROP CONSTRAINT IF EXISTS card_customizations_user_id_fkey;
ALTER TABLE card_customizations ADD CONSTRAINT card_customizations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
