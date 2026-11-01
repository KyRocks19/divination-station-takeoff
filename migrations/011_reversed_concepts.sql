-- Add polarity to card_concepts so reversed meanings can be tracked separately.
-- Existing rows are all upright; new reversed edges are inserted with reversed = true.
-- Idempotent — safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'card_concepts' AND column_name = 'reversed'
  ) THEN
    ALTER TABLE card_concepts DROP CONSTRAINT card_concepts_pkey;
    ALTER TABLE card_concepts ADD COLUMN reversed BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE card_concepts ADD PRIMARY KEY (card_id, concept_id, reversed);

    DROP INDEX IF EXISTS card_concepts_concept_id;
    DROP INDEX IF EXISTS card_concepts_card_id;
    CREATE INDEX card_concepts_concept_id ON card_concepts(concept_id);
    CREATE INDEX card_concepts_card_id    ON card_concepts(card_id);
    CREATE INDEX card_concepts_reversed   ON card_concepts(reversed);

    RAISE NOTICE 'Migration 011: reversed column added to card_concepts';
  ELSE
    RAISE NOTICE 'Migration 011: already applied, skipping';
  END IF;
END;
$$;
