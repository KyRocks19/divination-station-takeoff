-- Open item S6: a log of what administrators do (password resets, switch-offs, deletions, limits, invites, picture-computer tokens,
-- report decisions), readable on /admin/log. Names are copied into each row so the record stays readable after an account is deleted.
-- It holds no passwords, codes, tokens or anyone's writing. admin_id and target_id are plain numbers, not foreign keys, for the same reason.
CREATE TABLE IF NOT EXISTS admin_log (
  id          SERIAL PRIMARY KEY,
  admin_id    INTEGER,
  admin_name  TEXT NOT NULL,
  action      TEXT NOT NULL,
  target_id   INTEGER,
  target_name TEXT,
  detail      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS admin_log_created_idx ON admin_log (created_at DESC, id DESC);
