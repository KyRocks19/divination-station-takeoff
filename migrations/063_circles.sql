-- Circles, first build (the user's decisions of 2026-10-16): a household or friend group with one owner. People who already have an
-- account join with a single-use code from the owner. A person belongs to at most one circle, and only people an admin switches on
-- (users.can_make_circles, admins always) can make one. Nothing anyone writes is shared by being in a circle; later builds add a shared
-- Claude key and the circle's own picture computer.
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_make_circles INTEGER NOT NULL DEFAULT 0 CHECK (can_make_circles IN (0, 1));

CREATE TABLE IF NOT EXISTS circles (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  -- The owner is also a row in circle_members. When the owner's account is deleted, lib/circles.ts hands the circle to the member who
  -- joined first; the cascade only removes a circle nobody else is in.
  owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS circles_one_per_owner ON circles(owner_id);

CREATE TABLE IF NOT EXISTS circle_members (
  circle_id   INTEGER NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (circle_id, user_id)
);
-- One circle per person, kept by the database itself so two joins at once cannot both succeed.
CREATE UNIQUE INDEX IF NOT EXISTS circle_members_one_circle ON circle_members(user_id);

-- Single-use codes, like the app's own invite codes (lib/invites.ts): only a hash is kept, the code is shown once to the circle's owner.
CREATE TABLE IF NOT EXISTS circle_invites (
  id          SERIAL PRIMARY KEY,
  circle_id   INTEGER NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  code_hash   TEXT NOT NULL UNIQUE,
  note        TEXT CHECK (note IS NULL OR char_length(note) <= 100),
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  used_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  revoked_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS circle_invites_circle ON circle_invites(circle_id);
