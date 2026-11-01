-- The AI companion (slice 6): off for every account until the person turns it on, and a name the person can give it.
ALTER TABLE users ADD COLUMN IF NOT EXISTS companion_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS companion_name TEXT CHECK (companion_name IS NULL OR char_length(companion_name) <= 40);
