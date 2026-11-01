-- Layouts: a person's own named positions, usable by any tool that draws several things.
CREATE TABLE IF NOT EXISTS layouts (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  -- The person's own starting question for a draw with this layout. Empty until they write one.
  question    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS layout_positions (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  layout_id  INTEGER NOT NULL REFERENCES layouts(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  -- The person's own question for this position. Empty until they write one.
  prompt     TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS layouts_user_id            ON layouts(user_id);
CREATE INDEX IF NOT EXISTS layout_positions_layout_id ON layout_positions(layout_id, sort_order);

-- Which layout a reading used. The layout can be deleted later; the reading keeps its name.
ALTER TABLE divinations ADD COLUMN IF NOT EXISTS layout_id   INTEGER REFERENCES layouts(id) ON DELETE SET NULL;
ALTER TABLE divinations ADD COLUMN IF NOT EXISTS layout_name TEXT;

-- Where each item fell, as the position was named at the time. Empty for a draw with no layout.
ALTER TABLE rune_draws         ADD COLUMN IF NOT EXISTS position_name TEXT;
ALTER TABLE ogham_draws        ADD COLUMN IF NOT EXISTS position_name TEXT;
ALTER TABLE oracle_pull_cards  ADD COLUMN IF NOT EXISTS position_name TEXT;
