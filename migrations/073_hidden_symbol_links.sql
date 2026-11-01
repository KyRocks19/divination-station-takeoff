-- A person can hide a shared archetype link of a piece (a rune, an ogham letter, a die face, a swing, a scrying surface)
-- for themselves only (open item R4). The shared link is not changed and everyone else still sees it; for this person the
-- link is left off the piece's page, off the archetype pages and out of their Patterns counts. Showing it again deletes the
-- row. Only the person's own choice is kept: which piece, which archetype, when. Deleting the account deletes the rows
-- (ON DELETE CASCADE), and so does an archetype being removed.
CREATE TABLE IF NOT EXISTS user_hidden_links (
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol_id    TEXT    NOT NULL CHECK (char_length(symbol_id) BETWEEN 1 AND 80),
  archetype_id INTEGER NOT NULL REFERENCES archetypes(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, symbol_id, archetype_id)
);
