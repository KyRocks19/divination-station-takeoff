-- Per-account permission to be reached through the shared Claude tool key (/api/claude/**), set by an admin.
-- Accounts that exist when this runs are switched on; accounts created later start off.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'claude_access'
  ) THEN
    ALTER TABLE users ADD COLUMN claude_access INTEGER NOT NULL DEFAULT 0;
    UPDATE users SET claude_access = 1;
  END IF;
END;
$$;
