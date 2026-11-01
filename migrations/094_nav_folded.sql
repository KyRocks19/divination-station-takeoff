-- The parts of the side navigation a person folded away (Your tools, Your writings, Learn, Help, Admin, and the "Other tools"
-- list), kept in the account so the menu looks the same on every device. A comma-separated list of keys from NAV_FOLD_KEYS in
-- lib/nav-groups.ts; NULL means the starting arrangement (only "Other tools" folded), and an empty string means nothing folded.
ALTER TABLE users ADD COLUMN IF NOT EXISTS nav_folded TEXT;
