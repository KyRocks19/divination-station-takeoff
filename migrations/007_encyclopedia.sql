CREATE TABLE IF NOT EXISTS concepts (
  id                          SERIAL PRIMARY KEY,
  name                        TEXT UNIQUE NOT NULL,
  display_name                TEXT NOT NULL,
  description                 TEXT,
  description_generated_at    TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS card_concepts (
  card_id    TEXT    NOT NULL,
  concept_id INTEGER NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, concept_id)
);

CREATE TABLE IF NOT EXISTS concept_notes (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  concept_id INTEGER NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, concept_id)
);

CREATE INDEX IF NOT EXISTS card_concepts_concept_id ON card_concepts(concept_id);
CREATE INDEX IF NOT EXISTS card_concepts_card_id    ON card_concepts(card_id);
CREATE INDEX IF NOT EXISTS concept_notes_user_id    ON concept_notes(user_id);
