-- Failed sign-in attempts, kept in the database so the limit holds when the app runs on several servers
-- (the old in-memory counter reset on every serverless instance). One row per failed attempt; `key` is
-- 'ip:<address>' or 'user:<lowercased username>'. Rows older than a day are deleted as new ones are written.
-- No personal data beyond what a sign-in already sends; passwords are never stored here.
CREATE TABLE IF NOT EXISTS login_attempts (
  id           BIGSERIAL PRIMARY KEY,
  key          TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS login_attempts_key_time ON login_attempts(key, attempted_at DESC);
