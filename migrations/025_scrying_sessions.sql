-- Scrying: the tool's own record of one session at a surface. What the person saw is kept in journals.
CREATE TABLE IF NOT EXISTS scrying_sessions (
  divination_id INTEGER PRIMARY KEY REFERENCES divinations(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Which surface the person looked into: 'mirror', 'ball', or 'water'.
  surface       TEXT NOT NULL,
  -- How long the person looked, in whole minutes. Empty when they chose not to keep it.
  minutes       INTEGER
);

CREATE INDEX IF NOT EXISTS scrying_sessions_user_id ON scrying_sessions(user_id);
