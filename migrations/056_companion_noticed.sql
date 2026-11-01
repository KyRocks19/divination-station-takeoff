-- The companion's "what I have noticed about how you like to work" note (slice 6h).
-- companion_note is the person's own text: they write it, change it, clear it. It is sent with companion requests as their words, after the
-- fixed safety lines are set out, and it is shown in "Show what would be sent". The app counts facts in code (no model) and can ask the model
-- for one suggested line, which is only ever shown as placeholder text and is never saved unless the person types or accepts it.
ALTER TABLE users ADD COLUMN IF NOT EXISTS companion_note TEXT CHECK (companion_note IS NULL OR char_length(companion_note) <= 600);

-- A request for a suggested line is about the person, not a reading or an item, so it has neither.
ALTER TABLE companion_jobs DROP CONSTRAINT IF EXISTS companion_jobs_mode_check;
ALTER TABLE companion_jobs ADD CONSTRAINT companion_jobs_mode_check CHECK (mode IN ('questions', 'changes', 'reading', 'scene', 'noticed'));
ALTER TABLE companion_jobs DROP CONSTRAINT IF EXISTS companion_jobs_subject_check;
ALTER TABLE companion_jobs ADD CONSTRAINT companion_jobs_subject_check CHECK (
  (mode = 'noticed' AND num_nonnulls(divination_id, card_id) = 0) OR (mode <> 'noticed' AND num_nonnulls(divination_id, card_id) = 1)
);
