-- The companion can be asked a question about a pattern on the Patterns page: a symbol that keeps coming up, or one whose wording has shifted.
-- Such a request is about the person's own dates, entries and wordings for one symbol, not one reading, so it names the symbol in `pattern_ref`
-- ("runes:rune-fehu": the tool, a colon, the symbol's own key). The words are rebuilt from the person's rows when the studio answers; none are copied here.
ALTER TABLE companion_jobs ADD COLUMN IF NOT EXISTS pattern_ref TEXT CHECK (pattern_ref IS NULL OR char_length(pattern_ref) <= 120);

ALTER TABLE companion_jobs DROP CONSTRAINT IF EXISTS companion_jobs_mode_check;
ALTER TABLE companion_jobs ADD CONSTRAINT companion_jobs_mode_check CHECK (mode IN ('questions', 'changes', 'reading', 'scene', 'noticed', 'pattern'));

-- A request is about exactly one thing: a reading or an item (most modes), the person (a suggested line), or a pattern.
ALTER TABLE companion_jobs DROP CONSTRAINT IF EXISTS companion_jobs_subject_check;
ALTER TABLE companion_jobs ADD CONSTRAINT companion_jobs_subject_check CHECK (
  (mode = 'noticed' AND pattern_ref IS NULL AND num_nonnulls(divination_id, card_id) = 0)
  OR (mode = 'pattern' AND pattern_ref IS NOT NULL AND num_nonnulls(divination_id, card_id) = 0)
  OR (mode NOT IN ('noticed', 'pattern') AND pattern_ref IS NULL AND num_nonnulls(divination_id, card_id) = 1)
);

-- An answer to a pattern question can be kept with a day (as a snapshot of the questions, from the finished request).
ALTER TABLE day_items DROP CONSTRAINT IF EXISTS day_items_kind_check;
ALTER TABLE day_items ADD CONSTRAINT day_items_kind_check CHECK (kind IN ('reading', 'companion_note', 'synthesis_journal', 'forum_post', 'forum_comment', 'journal_entry', 'prediction', 'pattern_answer'));
