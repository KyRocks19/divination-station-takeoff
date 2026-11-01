-- Record the sky with each reading, and add per-user display preferences.
-- readings.sky is a JSON snapshot (moon phase, sun sign, planetary day, wheel of the year) taken when the reading is made.

ALTER TABLE readings ADD COLUMN IF NOT EXISTS sky TEXT;

ALTER TABLE users ADD COLUMN IF NOT EXISTS hemisphere       TEXT    NOT NULL DEFAULT 'north';
ALTER TABLE users ADD COLUMN IF NOT EXISTS scaffolding      TEXT    NOT NULL DEFAULT 'more';
ALTER TABLE users ADD COLUMN IF NOT EXISTS lookback_prompts INTEGER NOT NULL DEFAULT 1;
