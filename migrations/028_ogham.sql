-- Ogham: the record of which staves came up in one draw, and whether the five later letters are included.
-- Their own meanings for each stave are kept in card_customizations and card_meaning_revisions (ids like 'ogham-beith').
CREATE TABLE IF NOT EXISTS ogham_draws (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  divination_id INTEGER NOT NULL REFERENCES divinations(id) ON DELETE CASCADE,
  -- The stave's id in the set, for example 'ogham-beith'. The set is fixed in code.
  stave_id      TEXT NOT NULL,
  -- The stave's name as it was at the time.
  stave_name    TEXT NOT NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS ogham_draws_divination_id ON ogham_draws(divination_id);
CREATE INDEX IF NOT EXISTS ogham_draws_user_stave    ON ogham_draws(user_id, stave_id);

-- 0/1. 1 includes the five later letters (the forfeda) in a draw. Off for a new account.
ALTER TABLE users ADD COLUMN IF NOT EXISTS ogham_forfeda INTEGER NOT NULL DEFAULT 0;
