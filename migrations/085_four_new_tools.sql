-- Four new tools. Each reading is one shared record in `divinations` (with its own kind); these tables hold what is particular to the tool.
-- Everything is for one person and goes when the reading or the account goes (ON DELETE CASCADE).

-- Playing cards: the cards drawn from a 52-card pack. The meaning of a card is the person's own, kept in card_customizations under 'playing-<suit letter>-<rank>'.
CREATE TABLE IF NOT EXISTS playing_card_draws (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  divination_id INTEGER NOT NULL REFERENCES divinations(id) ON DELETE CASCADE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  -- For example 'H-7' (seven of hearts) or 'S-A' (ace of spades).
  card_id       TEXT NOT NULL,
  card_name     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS playing_card_draws_divination_id ON playing_card_draws(divination_id);
CREATE INDEX IF NOT EXISTS playing_card_draws_user_card     ON playing_card_draws(user_id, card_id);

-- Charm casting: each charm of one of the person's own sets (an oracle set of the form 'charms') cast onto a square cloth. Where it landed is a place from 0 to 1000
-- across and down, and which side showed. The charm's name and the set's name are kept as they were; the link to the charm is dropped if the charm is deleted.
CREATE TABLE IF NOT EXISTS charm_casts (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  divination_id INTEGER NOT NULL REFERENCES divinations(id) ON DELETE CASCADE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  set_name      TEXT NOT NULL,
  card_id       INTEGER REFERENCES oracle_cards(id) ON DELETE SET NULL,
  charm_name    TEXT NOT NULL,
  x             INTEGER NOT NULL CHECK (x BETWEEN 0 AND 1000),
  y             INTEGER NOT NULL CHECK (y BETWEEN 0 AND 1000),
  face          TEXT NOT NULL CHECK (face IN ('up', 'down'))
);
CREATE INDEX IF NOT EXISTS charm_casts_divination_id ON charm_casts(divination_id);

-- Signs and dreams: a note of something noticed or dreamed. Not a method, only a log, so it can be looked back on beside the person's readings.
CREATE TABLE IF NOT EXISTS sign_notes (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  divination_id INTEGER NOT NULL UNIQUE REFERENCES divinations(id) ON DELETE CASCADE,
  note_type     TEXT NOT NULL CHECK (note_type IN ('sign', 'dream')),
  body          TEXT NOT NULL,
  -- The day it happened, which may be before the note was written.
  happened_on   DATE
);
CREATE INDEX IF NOT EXISTS sign_notes_user_id ON sign_notes(user_id);

-- Blind-target practice: the person (or a friend) writes four possible targets; the app picks one by chance and keeps it sealed. The person writes their
-- impression first, which is sealed too (never changed after), then chooses which of the four it matches best. Only then is the target shown. The target
-- and the options are never sent to the browser, to the AI companion or into the export before the choice is made.
CREATE TABLE IF NOT EXISTS remoteview_trials (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  divination_id  INTEGER NOT NULL UNIQUE REFERENCES divinations(id) ON DELETE CASCADE,
  options        JSONB NOT NULL,
  target_index   INTEGER NOT NULL CHECK (target_index BETWEEN 0 AND 3),
  impression     TEXT,
  sealed_at      TIMESTAMPTZ,
  choice_index   INTEGER CHECK (choice_index BETWEEN 0 AND 3),
  judged_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS remoteview_trials_user_id ON remoteview_trials(user_id);
