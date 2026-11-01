-- Circles, build 2 (open items C1, C2, C5): a Claude key the circle's owner brings (stored encrypted, AES-256-GCM, master key only in the server's
-- environment), quotas per circle and per member, and each member's agreement to use the key holder's key. Nothing here is readable by a browser:
-- the key is never sent back (last four characters only).

-- One key per circle. ciphertext, iv and tag are the AES-256-GCM output (lib/secret-box.ts); the circle id is bound to it as extra data.
-- The key belongs to whoever set it: when the circle is handed over or its owner's account is deleted, lib/circles.ts removes it.
CREATE TABLE IF NOT EXISTS circle_claude_keys (
  circle_id  INTEGER PRIMARY KEY REFERENCES circles(id) ON DELETE CASCADE,
  ciphertext BYTEA NOT NULL,
  iv         BYTEA NOT NULL,
  tag        BYTEA NOT NULL,
  last4      TEXT NOT NULL CHECK (char_length(last4) = 4),
  set_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  set_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The owner's limits on their own money: Claude requests per member per day, and per circle per day (all members together).
ALTER TABLE circles ADD COLUMN IF NOT EXISTS claude_member_daily_limit INTEGER NOT NULL DEFAULT 15 CHECK (claude_member_daily_limit BETWEEN 0 AND 1000);
ALTER TABLE circles ADD COLUMN IF NOT EXISTS claude_daily_limit INTEGER NOT NULL DEFAULT 100 CHECK (claude_daily_limit BETWEEN 0 AND 10000);

-- Requests made through a circle's key, per member per day (the app's own ai_usage is not touched, so the app owner's limits do not count them).
CREATE TABLE IF NOT EXISTS circle_ai_usage (
  circle_id INTEGER NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day       DATE NOT NULL,
  calls     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (circle_id, user_id, day)
);

-- A member's agreement that what they send to Claude may go through the circle owner's key (set when they join, and by the button on the
-- Circle page for people who joined before this build). NULL means the app's own key is used for them, as before circles.
ALTER TABLE circle_members ADD COLUMN IF NOT EXISTS shares_with_host_at TIMESTAMPTZ;
