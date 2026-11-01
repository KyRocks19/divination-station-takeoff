-- The person's own order for the cards in a deck. Cards keep the order they were made in until the person moves one.
ALTER TABLE oracle_cards ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
