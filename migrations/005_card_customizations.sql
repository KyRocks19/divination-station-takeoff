-- Per-user card customizations: overrides for keywords and descriptions
CREATE TABLE IF NOT EXISTS card_customizations (
  user_id              INTEGER NOT NULL REFERENCES users(id),
  card_id              TEXT NOT NULL,
  upright_keywords     TEXT,
  reversed_keywords    TEXT,
  upright_description  TEXT,
  reversed_description TEXT,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, card_id)
);
