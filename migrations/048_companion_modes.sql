-- The AI companion can be asked for more than questions (slice 6c to 6f): what has changed over time, a reading built from the person's own words,
-- and ideas for a picture of one item. A request now says which `mode` it is, and is about either a reading (divination_id) or one item (card_id).
-- A finished answer of any mode other than questions has action 'reply'. Kept answers remember their mode.
ALTER TABLE companion_jobs ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'questions';
ALTER TABLE companion_jobs DROP CONSTRAINT IF EXISTS companion_jobs_mode_check;
ALTER TABLE companion_jobs ADD CONSTRAINT companion_jobs_mode_check CHECK (mode IN ('questions', 'changes', 'reading', 'scene'));

ALTER TABLE companion_jobs DROP CONSTRAINT IF EXISTS companion_jobs_action_check;
ALTER TABLE companion_jobs ADD CONSTRAINT companion_jobs_action_check CHECK (action IS NULL OR action IN ('questions', 'reply', 'crisis', 'checkin', 'gentle'));

ALTER TABLE companion_jobs ALTER COLUMN divination_id DROP NOT NULL;
ALTER TABLE companion_jobs ADD COLUMN IF NOT EXISTS card_id INTEGER REFERENCES oracle_cards(id) ON DELETE CASCADE;
ALTER TABLE companion_jobs DROP CONSTRAINT IF EXISTS companion_jobs_subject_check;
ALTER TABLE companion_jobs ADD CONSTRAINT companion_jobs_subject_check CHECK (num_nonnulls(divination_id, card_id) = 1);
CREATE INDEX IF NOT EXISTS companion_jobs_card ON companion_jobs(card_id) WHERE card_id IS NOT NULL;

ALTER TABLE companion_notes ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'questions';
ALTER TABLE companion_notes DROP CONSTRAINT IF EXISTS companion_notes_mode_check;
ALTER TABLE companion_notes ADD CONSTRAINT companion_notes_mode_check CHECK (mode IN ('questions', 'changes', 'reading'));
