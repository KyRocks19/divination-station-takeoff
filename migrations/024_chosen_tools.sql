-- Which divination tools a person has chosen to see first, as a comma-separated list of kinds, for example
-- 'tarot,oracle'. NULL means every tool, which is what a new account has. It is a starting filter, not a lock.
ALTER TABLE users ADD COLUMN IF NOT EXISTS chosen_tools TEXT;
