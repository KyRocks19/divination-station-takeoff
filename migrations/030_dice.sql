-- Dice and coins: the record of what came up in one throw. Their own meanings for each face are kept in
-- card_customizations and card_meaning_revisions (ids like 'die-d6-3' and 'coin-heads').
CREATE TABLE IF NOT EXISTS dice_throws (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  divination_id INTEGER NOT NULL REFERENCES divinations(id) ON DELETE CASCADE,
  -- What was thrown: 'coin', 'd4', 'd6', 'd8', 'd10', 'd12', 'd20', or 'd100'.
  object        TEXT NOT NULL,
  -- What came up, as plain text: 'heads', 'tails', or the number.
  face          TEXT NOT NULL,
  -- The layout position this result belongs to, as it was named at the time. Empty for a throw with no layout.
  position_name TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS dice_throws_divination_id ON dice_throws(divination_id);
CREATE INDEX IF NOT EXISTS dice_throws_user_face     ON dice_throws(user_id, object, face);
