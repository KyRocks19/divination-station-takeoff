-- Invite codes (pre-beta polish). The owner makes a single-use code, gives it to someone, and that person makes their own account with it at /join.
-- Only a hash of the code is kept (the code itself is shown once, when it is made). A code works once, expires, and can be revoked while unused.
-- created_by and used_by are set to NULL if those accounts are deleted, so the record of a code outlives either account.
CREATE TABLE IF NOT EXISTS invite_codes (
  id         SERIAL PRIMARY KEY,
  code_hash  TEXT NOT NULL UNIQUE,
  -- A word for the owner's own use, such as who the code is for. Never shown to the person who joins.
  note       TEXT CHECK (note IS NULL OR char_length(note) <= 100),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  used_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS invite_codes_created ON invite_codes(created_at DESC);
