-- Runes: the record of which runes came up in one draw, and the person's choice about upside-down runes.
-- Their own meanings for each rune are kept in card_customizations and card_meaning_revisions (ids like 'rune-fehu').
CREATE TABLE IF NOT EXISTS rune_draws (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  divination_id INTEGER NOT NULL REFERENCES divinations(id) ON DELETE CASCADE,
  -- The rune's id in the set, for example 'rune-fehu'. The set is fixed in code, so there is no link to a table.
  rune_id       TEXT NOT NULL,
  -- The rune's name as it was at the time.
  rune_name     TEXT NOT NULL,
  -- 1 means the rune landed upside down. Only happens when the person has turned reversals on.
  reversed      INTEGER NOT NULL DEFAULT 0,
  sort_order    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS rune_draws_divination_id ON rune_draws(divination_id);
CREATE INDEX IF NOT EXISTS rune_draws_user_rune     ON rune_draws(user_id, rune_id);

-- Off for a new account. When on, a drawn rune can land upside down, about this many times out of 100.
ALTER TABLE users ADD COLUMN IF NOT EXISTS runes_reversals       INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS runes_reversal_chance INTEGER NOT NULL DEFAULT 50;
