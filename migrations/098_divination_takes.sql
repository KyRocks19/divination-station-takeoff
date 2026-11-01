-- Takes on divination (owner's requests, 2026-10-26): the ones a person kept from the home page, and the ones they wrote. The
-- app's takes stay in code (lib/divination-takes-core.ts), so a kept row only says which one and when. Both are deleted with the account.
CREATE TABLE IF NOT EXISTS user_divination_takes (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  take_id     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, take_id)
);

CREATE TABLE IF NOT EXISTS user_own_takes (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_own_takes_user ON user_own_takes (user_id, created_at);
