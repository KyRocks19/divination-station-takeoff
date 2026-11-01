-- Open item S2: a person's own tokens for the Claude tool routes (/api/claude/**), made, named and revoked in Settings. A token acts for the
-- one account that made it and nothing else, which the shared CLAUDE_API_KEY could not promise. Only a SHA-256 hash is kept; the token is shown once.
CREATE TABLE IF NOT EXISTS claude_tokens (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  token_hash   TEXT NOT NULL UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS claude_tokens_user_idx ON claude_tokens (user_id);
