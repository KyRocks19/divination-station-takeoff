-- A journal entry about a reading can be marked as the person's thinking mind talking (a guess, a memory, a story), as against
-- what they sensed first. 0/1. The marker is the person's own and can be added or removed at any time.
ALTER TABLE journals ADD COLUMN IF NOT EXISTS thinking_mind INTEGER NOT NULL DEFAULT 0;
