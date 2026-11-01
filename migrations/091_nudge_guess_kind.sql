-- Nudges on today's page gain a third kind, 'guess': a "what you sensed first" note with no answer yet on how well it fitted (GF1 d).
-- `target_id` for this kind is the reading's shared record id (`divinations.id`), the same key `reading_guesses` uses.

ALTER TABLE nudge_dismissals DROP CONSTRAINT IF EXISTS nudge_dismissals_kind_check;
ALTER TABLE nudge_dismissals ADD CONSTRAINT nudge_dismissals_kind_check CHECK (kind IN ('prediction', 'lookback', 'guess'));
