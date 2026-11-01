-- Open item S5: recovery codes. A person makes a set of single-use codes in Settings (shown once; only a SHA-256 hash is kept) and can
-- use one at /recover to set a new password if they forget theirs, with no email involved. Making a new set replaces the old unused ones.
CREATE TABLE IF NOT EXISTS recovery_codes (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash  TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS recovery_codes_user_idx ON recovery_codes (user_id);
