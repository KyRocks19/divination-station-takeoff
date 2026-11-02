-- Takes on divination a person hid (owner's request, 2026-11-01): one they do not want to see again stops coming round on the home
-- page, and can be shown again from the Divination page. Like a kept row, a hidden row only says which take and when. Deleted with the account.
-- older-versions: ok
CREATE TABLE IF NOT EXISTS user_hidden_divination_takes (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  take_id     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, take_id)
);
