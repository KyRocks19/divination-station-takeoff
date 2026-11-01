-- The AI companion's questions (slice 6b). A request waits here until the studio on the owner's computer (or this server, when it can reach the
-- model itself) answers it. The person's words are NOT copied into the job: the studio reads them from the person's own rows when it runs.
-- A finished result waits for the person to Keep or Discard it, and old ones are swept away after a day. `action` says what the person is
-- shown: 'questions' (the companion's questions), 'crisis' (a fixed reply, no model asked), 'checkin' (a fixed gentle pause), or 'gentle' (a fixed note when questions could not be written without repeating worrying words).
CREATE TABLE IF NOT EXISTS companion_jobs (
  id            BIGSERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  divination_id INTEGER NOT NULL REFERENCES divinations(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed', 'cancelled')),
  -- 0/1. 1 when the person has already seen the gentle check-in and chose to carry on.
  acknowledged  INTEGER NOT NULL DEFAULT 0,
  action        TEXT CHECK (action IN ('questions', 'crisis', 'checkin', 'gentle')),
  result        TEXT CHECK (result IS NULL OR char_length(result) <= 6000),
  error         TEXT,
  model         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS companion_jobs_user ON companion_jobs(user_id, id);
CREATE INDEX IF NOT EXISTS companion_jobs_waiting ON companion_jobs(status, created_at) WHERE status IN ('queued', 'running');

-- Questions the person chose to keep. Kept apart from their own writing on purpose: they are never sent back to the model as if the person had written them.
CREATE TABLE IF NOT EXISTS companion_notes (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  divination_id  INTEGER NOT NULL REFERENCES divinations(id) ON DELETE CASCADE,
  -- The companion's name when it asked, as the person had named it then.
  companion_name TEXT NOT NULL DEFAULT 'Companion',
  content        TEXT NOT NULL CHECK (char_length(content) <= 6000),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS companion_notes_divination ON companion_notes(divination_id);

ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS companion INTEGER NOT NULL DEFAULT 0;
