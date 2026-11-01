-- Open item S8: usernames ignore capitals at sign-in, and the database now refuses two accounts that differ only by capitals.
-- The unique index is made only when no two accounts already do (run `npx tsx scripts/check-username-case.ts` to see them); otherwise
-- this migration leaves a notice and does nothing, and sign-in still prefers the exact spelling.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM users GROUP BY LOWER(username) HAVING COUNT(*) > 1) THEN
    RAISE NOTICE 'Two accounts differ only by capitals: users_username_lower_idx not created. Rename one, then run this migration again.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx ON users (LOWER(username));
  END IF;
END $$;
