-- A page for each day (the daily journal). The person's own writing for a day, and the things they chose to keep with it.
-- A day is a calendar date in the person's own time zone (the browser sends the date), so the date is the key, not a moment.
CREATE TABLE IF NOT EXISTS day_entries (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day        DATE NOT NULL,
  -- The person's own writing for the day, as markdown.
  body       TEXT NOT NULL DEFAULT '' CHECK (char_length(body) <= 20000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, day)
);

-- A thing kept with a day. The person chooses each time between a snapshot (a copy of what it said, kept here) and a live link
-- (shows the current version). `ref_id` points at the original in the table for its kind; it has no foreign key because the kinds live in
-- different tables, so an original that is deleted later is noticed when the day is opened ("the original is gone"; a snapshot stays).
CREATE TABLE IF NOT EXISTS day_items (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day        DATE NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('reading', 'companion_note', 'synthesis_journal', 'forum_post', 'forum_comment', 'journal_entry', 'prediction')),
  mode       TEXT NOT NULL CHECK (mode IN ('snapshot', 'link')),
  ref_id     INTEGER NOT NULL,
  -- A snapshot keeps what it said then. A live link keeps neither.
  title      TEXT CHECK (title IS NULL OR char_length(title) <= 300),
  snapshot   TEXT CHECK (snapshot IS NULL OR char_length(snapshot) <= 20000),
  -- Where the original lives, so the day can link back to it. Empty when the person chose not to link back.
  href       TEXT CHECK (href IS NULL OR char_length(href) <= 300),
  -- For a kept answer: the reading it came from, so the link back survives the answer being deleted later while the reading still exists.
  source_id  INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((mode = 'snapshot' AND snapshot IS NOT NULL) OR (mode = 'link' AND snapshot IS NULL))
);
CREATE INDEX IF NOT EXISTS day_items_user_day ON day_items(user_id, day);
-- The same thing is not kept twice in the same way on the same day.
CREATE UNIQUE INDEX IF NOT EXISTS day_items_once ON day_items(user_id, day, kind, ref_id, mode);

-- Whether a day's page lists that day's readings by itself (as links, nothing copied). On for everyone; people who make many readings can turn it off.
ALTER TABLE users ADD COLUMN IF NOT EXISTS days_list_readings INTEGER NOT NULL DEFAULT 1;
