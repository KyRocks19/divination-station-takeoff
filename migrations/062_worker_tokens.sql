-- Picture computers ("workers") sign in to a small API with a token of their own instead of holding the database password (security audit, plan item 2).
-- Only a SHA-256 hash of each token is kept; the token itself is shown once, when an admin makes it on /admin/workers. A token can be revoked, never edited.
-- Each job remembers which worker claimed it, so a worker can only send back pictures and answers for its own jobs. Revoking a token puts its
-- unfinished jobs back in the queue; deleting a token row (not offered in the app) leaves its old jobs with no worker.
CREATE TABLE IF NOT EXISTS worker_tokens (
  id            SERIAL PRIMARY KEY,
  token_hash    TEXT NOT NULL UNIQUE,
  -- A name for the owner's own use, such as whose computer it is.
  name          TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  -- What the token may take from the queue: pictures, and requests for the AI companion (which carry people's own words).
  can_pictures  INTEGER NOT NULL DEFAULT 1 CHECK (can_pictures IN (0, 1)),
  can_companion INTEGER NOT NULL DEFAULT 0 CHECK (can_companion IN (0, 1)),
  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at  TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ
);

ALTER TABLE image_jobs ADD COLUMN IF NOT EXISTS worker_id INTEGER REFERENCES worker_tokens(id) ON DELETE SET NULL;
ALTER TABLE companion_jobs ADD COLUMN IF NOT EXISTS worker_id INTEGER REFERENCES worker_tokens(id) ON DELETE SET NULL;
