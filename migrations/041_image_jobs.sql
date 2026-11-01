-- A queue of pictures to be made by the owner's own computer. The website cannot reach that computer, so a request waits here
-- and a small program on the computer (scripts/image-worker.ts) takes jobs from the front, makes the picture with the image
-- tool, and puts it back. A finished picture waits here until the person collects it (or for 24 hours), then the row is deleted.
-- `ai_usage.pictures` counts pictures asked for per person per day; `users.image_daily_limit` overrides the default limit
-- for one person (0 switches picture-making off for them; NULL means the default).
CREATE TABLE IF NOT EXISTS image_jobs (
  id          BIGSERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id     INTEGER REFERENCES oracle_cards(id) ON DELETE SET NULL,
  status      TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed', 'cancelled')),
  prompt      TEXT NOT NULL CHECK (char_length(prompt) <= 2000),
  form        TEXT NOT NULL DEFAULT 'cards',
  result      BYTEA CHECK (octet_length(result) <= 1500000),
  result_mime TEXT,
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at  TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS image_jobs_user ON image_jobs(user_id, id);
CREATE INDEX IF NOT EXISTS image_jobs_waiting ON image_jobs(status, created_at) WHERE status IN ('queued', 'running');

ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS pictures INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS image_daily_limit INTEGER;
