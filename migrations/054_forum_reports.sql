-- Forum reports (pre-beta polish). Anyone signed in can report a post or a comment; a post or comment that is reported by enough different people (HIDE_AFTER in lib/forum-reports.ts)
-- (while those reports are open) is hidden from everyone but its author and the owner until the owner has looked at it. The owner then keeps it
-- up (the reports are marked resolved and it is shown again) or deletes it. A person can report the same thing once, ever.
ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;
ALTER TABLE forum_comments ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS forum_reports (
  id          SERIAL PRIMARY KEY,
  reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id     INTEGER REFERENCES forum_posts(id) ON DELETE CASCADE,
  comment_id  INTEGER REFERENCES forum_comments(id) ON DELETE CASCADE,
  reason      TEXT CHECK (reason IS NULL OR char_length(reason) <= 500),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Set when the owner has looked: the report no longer counts toward hiding.
  resolved_at TIMESTAMPTZ,
  CHECK (num_nonnulls(post_id, comment_id) = 1)
);
CREATE UNIQUE INDEX IF NOT EXISTS forum_reports_once_per_post ON forum_reports(reporter_id, post_id) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS forum_reports_once_per_comment ON forum_reports(reporter_id, comment_id) WHERE comment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS forum_reports_open ON forum_reports(post_id, comment_id) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS forum_reports_reporter_day ON forum_reports(reporter_id, created_at);
