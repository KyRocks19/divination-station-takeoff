-- A journal entry can belong to a reading of any kind: a tarot reading (reading_id) or a shared record
-- (divination_id). Existing entries are not changed. Every entry still has to belong to a reading.

ALTER TABLE journals ADD COLUMN IF NOT EXISTS divination_id INTEGER REFERENCES divinations(id) ON DELETE CASCADE;
ALTER TABLE journals ALTER COLUMN reading_id DROP NOT NULL;

ALTER TABLE journals DROP CONSTRAINT IF EXISTS journals_belongs_to_a_reading;
ALTER TABLE journals ADD CONSTRAINT journals_belongs_to_a_reading
  CHECK (reading_id IS NOT NULL OR divination_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS journals_divination_id ON journals(divination_id) WHERE divination_id IS NOT NULL;
