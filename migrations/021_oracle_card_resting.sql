-- A resting card stays in its deck with everything written on it, and is not pulled until the person wakes it. 0/1.
ALTER TABLE oracle_cards ADD COLUMN IF NOT EXISTS resting INTEGER NOT NULL DEFAULT 0;
