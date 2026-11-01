-- How many times each person has asked Claude for help on each day, so one account cannot run up the bill. One row per
-- person per day; `calls` goes up by one for each request that reaches Claude. `users.ai_daily_limit` overrides the
-- default daily limit for one person (0 switches Claude help off for them; NULL means the default).
CREATE TABLE IF NOT EXISTS ai_usage (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day     DATE    NOT NULL,
  calls   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_daily_limit INTEGER;
