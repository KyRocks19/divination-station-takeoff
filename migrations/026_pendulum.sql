-- Pendulum: a person's own swings (five to begin with, more at whole-degree angles), what each means to them, the wordings it replaced, and each answer.
CREATE TABLE IF NOT EXISTS pendulum_swings (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- 'line' (back and forth along a line), 'circle_cw', 'circle_ccw', or 'still'.
  shape      TEXT NOT NULL,
  -- For a line: whole degrees clockwise from straight up and down, 0 up to but not including 180.
  angle      INTEGER,
  -- A name the person gave an added swing. Empty means the app's name for it is shown.
  name       TEXT,
  -- 1 for the five swings every person starts with: they can be left out of play but not deleted.
  builtin    INTEGER NOT NULL DEFAULT 0,
  -- The person's own words for what this swing means to them. Empty until they write it.
  meaning    TEXT,
  -- 1 means the swing can come up; 0 leaves it out.
  in_play    INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (shape IN ('line', 'circle_cw', 'circle_ccw', 'still')),
  CHECK ((shape = 'line') = (angle IS NOT NULL)),
  CHECK (angle IS NULL OR (angle >= 0 AND angle < 180))
);

-- One swing per line angle, and one of each other shape.
CREATE UNIQUE INDEX IF NOT EXISTS pendulum_swings_line_angle ON pendulum_swings(user_id, angle) WHERE shape = 'line';
CREATE UNIQUE INDEX IF NOT EXISTS pendulum_swings_shape ON pendulum_swings(user_id, shape) WHERE shape <> 'line';

-- The wordings a swing's meaning had before it was changed, each dated when it was written.
-- The current wording is on the swing itself.
CREATE TABLE IF NOT EXISTS pendulum_swing_revisions (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  swing_id   INTEGER NOT NULL REFERENCES pendulum_swings(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pendulum_swing_revisions_swing ON pendulum_swing_revisions(swing_id, created_at DESC);

-- The pendulum's own record of one answer. The swing and the person's wording are kept as they were then.
CREATE TABLE IF NOT EXISTS pendulum_answers (
  divination_id INTEGER PRIMARY KEY REFERENCES divinations(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- The swing can be deleted later; the answer stays.
  swing_id      INTEGER REFERENCES pendulum_swings(id) ON DELETE SET NULL,
  shape         TEXT NOT NULL,
  angle         INTEGER,
  swing_name    TEXT NOT NULL,
  meaning       TEXT
);

CREATE INDEX IF NOT EXISTS pendulum_answers_swing_id ON pendulum_answers(swing_id);
CREATE INDEX IF NOT EXISTS pendulum_answers_user_id ON pendulum_answers(user_id);
