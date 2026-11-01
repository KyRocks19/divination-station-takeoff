-- Oracle deck kit: a person's own decks, the cards in them, and the person's own words for each card.
-- Nothing is seeded. A new deck has no cards, and a new card has no meaning until the person writes one.

CREATE TABLE IF NOT EXISTS oracle_decks (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  -- 0/1. When 1, a pulled card can land upside down. Off for a new deck.
  reversals   INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only the name is required. origin = where the card comes from, in the person's words.
CREATE TABLE IF NOT EXISTS oracle_cards (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deck_id    INTEGER NOT NULL REFERENCES oracle_decks(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  origin     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A card can hold several meanings side by side. label is optional free text (for example, who wrote it).
-- reversed = 1 marks a meaning for the card upside down; only used when the deck has reversals on.
CREATE TABLE IF NOT EXISTS oracle_card_meanings (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id    INTEGER NOT NULL REFERENCES oracle_cards(id) ON DELETE CASCADE,
  label      TEXT,
  content    TEXT NOT NULL DEFAULT '',
  reversed   INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Every saved version of a meaning. oracle_card_meanings holds the current version; each change adds a row here.
CREATE TABLE IF NOT EXISTS oracle_card_meaning_revisions (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meaning_id INTEGER NOT NULL REFERENCES oracle_card_meanings(id) ON DELETE CASCADE,
  label      TEXT,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fields the person names themselves, for example "song" or "season".
CREATE TABLE IF NOT EXISTS oracle_card_fields (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id    INTEGER NOT NULL REFERENCES oracle_cards(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  value      TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS oracle_decks_user_id         ON oracle_decks(user_id);
CREATE INDEX IF NOT EXISTS oracle_cards_user_id         ON oracle_cards(user_id);
CREATE INDEX IF NOT EXISTS oracle_cards_deck_id         ON oracle_cards(deck_id);
CREATE INDEX IF NOT EXISTS oracle_card_meanings_card_id ON oracle_card_meanings(card_id);
CREATE INDEX IF NOT EXISTS oracle_card_fields_card_id   ON oracle_card_fields(card_id);
CREATE INDEX IF NOT EXISTS oracle_card_meaning_revisions_meaning
  ON oracle_card_meaning_revisions(meaning_id, created_at DESC);
