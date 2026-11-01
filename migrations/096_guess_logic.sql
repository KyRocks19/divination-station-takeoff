-- What the person's logical mind said, written beside their first impression before a reading is shown (owner's request, 2026-10-25).
-- Optional; NULL when nothing was written. Kept apart from the guess so the two can be compared later.
ALTER TABLE reading_guesses ADD COLUMN IF NOT EXISTS logic TEXT;
