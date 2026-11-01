-- Two columns of `users` exist on the live database but no migration made them (an older version of the app, and the archived tower game's
-- avatar). Nothing in the code uses them now, but live holds their values, so a fresh database must have them or a restore of live would
-- lose them. On live this does nothing.
ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_provider TEXT NOT NULL DEFAULT 'claude';
ALTER TABLE users ADD COLUMN IF NOT EXISTS seeker_config TEXT;
