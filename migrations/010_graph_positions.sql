CREATE TABLE IF NOT EXISTS graph_positions (
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  node_id  TEXT    NOT NULL,
  x        DOUBLE PRECISION NOT NULL,
  y        DOUBLE PRECISION NOT NULL,
  PRIMARY KEY (user_id, node_id)
);

CREATE INDEX IF NOT EXISTS graph_positions_user_id ON graph_positions(user_id);
