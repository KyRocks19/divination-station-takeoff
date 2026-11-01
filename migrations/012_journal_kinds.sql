-- Journal entries get a kind (note / impression / lookback) and, for per-card entries, the card they are about.
-- 'impression' = what the user saw in a card before reading any meaning; 'lookback' = what happened afterwards.

ALTER TABLE journals ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'note';
ALTER TABLE journals ADD COLUMN IF NOT EXISTS card_id TEXT;

ALTER TABLE journals DROP CONSTRAINT IF EXISTS journals_kind_check;
ALTER TABLE journals ADD CONSTRAINT journals_kind_check
  CHECK (kind IN ('note', 'impression', 'lookback'));

CREATE INDEX IF NOT EXISTS journals_card_id      ON journals(card_id) WHERE card_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS journals_reading_kind ON journals(reading_id, kind);
