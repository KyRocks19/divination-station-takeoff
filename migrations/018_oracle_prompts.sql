-- Per-user switch for the question prompts in the oracle deck kit (on by default).
ALTER TABLE users ADD COLUMN IF NOT EXISTS oracle_prompts INTEGER NOT NULL DEFAULT 1;
