-- Optional recent searches in the header search window. Off for everyone until they turn it on (users.remember_searches,
-- 0 or 1). When on, the words a person searched for just before opening a result are kept, the newest 20, so they can run
-- them again. Only that person sees them; they go nowhere else (not to the companion, not to any model). Turning the
-- switch off, or "clear", deletes them. Deleting the account deletes them (ON DELETE CASCADE).
ALTER TABLE users ADD COLUMN IF NOT EXISTS remember_searches INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS recent_searches (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query       TEXT NOT NULL CHECK (char_length(query) BETWEEN 2 AND 100),
  searched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The same words in other capitals are one search.
CREATE UNIQUE INDEX IF NOT EXISTS recent_searches_user_query ON recent_searches(user_id, lower(query));
CREATE INDEX IF NOT EXISTS recent_searches_user_time ON recent_searches(user_id, searched_at DESC);
