-- Tea leaves and ink shapes: the app draws a random shape from a seed (a whole number) and the person writes what they see. The reading is one shared record in
-- `divinations` (kind 'blots'); the seed and the kind of shape are kept here so the same shape can be drawn again exactly.
CREATE TABLE IF NOT EXISTS blot_casts (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  divination_id INTEGER NOT NULL UNIQUE REFERENCES divinations(id) ON DELETE CASCADE,
  vessel        TEXT NOT NULL CHECK (vessel IN ('cup', 'ink')),
  seed          INTEGER NOT NULL CHECK (seed >= 0)
);
CREATE INDEX IF NOT EXISTS blot_casts_user_id ON blot_casts(user_id);
