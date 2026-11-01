-- One shared record for every reading of any kind, plus the oracle deck's own tables for a pull.
-- Each kind of divination keeps its own tables for its own details. Journals and comparisons point at
-- `divinations`, so readings of different kinds can be set side by side.

CREATE TABLE IF NOT EXISTS divinations (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Which tool made the reading: 'oracle' for now. Runes, ogham, pendulum, scrying, tarot and others come later.
  kind       TEXT NOT NULL,
  title      TEXT,
  question   TEXT,
  -- One plain line saying what came up, kept as it was at the time. Used in lists and comparisons across kinds.
  summary    TEXT NOT NULL DEFAULT '',
  -- JSON snapshot of the sky when the reading was made, in the same shape as readings.sky.
  sky        TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The oracle deck's own record of a pull.
CREATE TABLE IF NOT EXISTS oracle_pulls (
  divination_id INTEGER PRIMARY KEY REFERENCES divinations(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- The deck can be deleted later. The pull stays, with the deck's name as it was.
  deck_id       INTEGER REFERENCES oracle_decks(id) ON DELETE SET NULL,
  deck_name     TEXT NOT NULL
);

-- The cards that came up in a pull. One card for now; layouts with several cards come later.
CREATE TABLE IF NOT EXISTS oracle_pull_cards (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  divination_id INTEGER NOT NULL REFERENCES divinations(id) ON DELETE CASCADE,
  -- The card can be deleted later. The pull stays, with the card's name as it was.
  card_id       INTEGER REFERENCES oracle_cards(id) ON DELETE SET NULL,
  card_name     TEXT NOT NULL,
  -- 0/1. 1 means the card landed upside down. Only happens when the deck has reversals on.
  reversed      INTEGER NOT NULL DEFAULT 0,
  sort_order    INTEGER NOT NULL DEFAULT 0
);

-- When a deck has reversals on: out of 100 pulls, about how many land upside down. The person sets it per deck.
ALTER TABLE oracle_decks ADD COLUMN IF NOT EXISTS reversal_chance INTEGER NOT NULL DEFAULT 50;

CREATE INDEX IF NOT EXISTS divinations_user_created        ON divinations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS oracle_pulls_deck_id            ON oracle_pulls(deck_id);
CREATE INDEX IF NOT EXISTS oracle_pull_cards_divination_id ON oracle_pull_cards(divination_id);
CREATE INDEX IF NOT EXISTS oracle_pull_cards_card_id       ON oracle_pull_cards(card_id);
