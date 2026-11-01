-- Lets an admin switch an account off, and lets a password change end the sessions that were signed in before it.
-- `disabled` is 0/1 (1 = the account cannot sign in and its open sessions stop working). `session_version` goes up by one
-- when a password changes; a session cookie remembers the number it was made with and stops working when it no longer matches.
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;
