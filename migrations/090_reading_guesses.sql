-- "Write what you sense first": before the meanings of a reading are opened, the person can write what they sense about it (or set the step aside).
-- One row per reading, for a reading of any tool (it hangs off the shared record, `divinations`). The guess is sealed when it is saved: its words
-- are never changed afterwards. Later the person says how well it fitted what they went on to read or what happened; the app never judges either.
CREATE TABLE IF NOT EXISTS reading_guesses (
  divination_id INTEGER PRIMARY KEY REFERENCES divinations(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Empty when the person set the step aside for this reading.
  guess         TEXT NOT NULL DEFAULT '',
  skipped       BOOLEAN NOT NULL DEFAULT FALSE,
  sealed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- How well the guess fitted, 1 (not at all) to 5 (very well); null until the person says.
  fit           SMALLINT CHECK (fit IS NULL OR fit BETWEEN 1 AND 5),
  fit_note      TEXT,
  fit_at        TIMESTAMPTZ,
  CHECK ((skipped AND guess = '') OR (NOT skipped AND guess <> ''))
);
CREATE INDEX IF NOT EXISTS reading_guesses_user ON reading_guesses(user_id, sealed_at);

-- On for everyone until they turn it off in Settings.
ALTER TABLE users ADD COLUMN IF NOT EXISTS guess_first SMALLINT NOT NULL DEFAULT 1;
