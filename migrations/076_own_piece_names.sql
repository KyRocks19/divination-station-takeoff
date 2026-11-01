-- A person's own name for a piece of a tool, such as one side of a knucklebone (open item T17, decided 2026-10-18: Y7). It is a name the person
-- chooses; the app supplies none. Private to the person, deleted with the account. The piece ids are the ones in lib/symbol-ids.ts. Additive and
-- safe to run twice. The code works without it: until it is run, the screens show no own names and saving one says it is not available yet.
CREATE TABLE IF NOT EXISTS symbol_own_names (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  piece_id   TEXT NOT NULL CHECK (char_length(piece_id) BETWEEN 1 AND 80),
  name       TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, piece_id)
);
