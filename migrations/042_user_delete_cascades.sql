-- Deleting an account failed for anyone who had a reading or a spread of their own, because those two tables pointed at the
-- account without "ON DELETE CASCADE" (every other table already had it). Now the account's readings and spreads go with it,
-- as the Delete button in Settings already says they do.
ALTER TABLE readings DROP CONSTRAINT IF EXISTS readings_user_id_fkey;
ALTER TABLE readings ADD CONSTRAINT readings_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE spreads DROP CONSTRAINT IF EXISTS spreads_user_id_fkey;
ALTER TABLE spreads ADD CONSTRAINT spreads_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
