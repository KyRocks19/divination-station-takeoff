-- The form of a personal set (to-do item 2c): a deck of cards, a bag of stones, a bundle of staves, or a pouch of
-- charms. The form only changes the wording and the shape drawn for each item; everything the person has written
-- (items, meanings, fields, order, pulls, layouts) works the same in every form. Every existing deck stays 'cards'.
ALTER TABLE oracle_decks ADD COLUMN IF NOT EXISTS form TEXT NOT NULL DEFAULT 'cards';
ALTER TABLE oracle_decks DROP CONSTRAINT IF EXISTS oracle_decks_form_check;
ALTER TABLE oracle_decks ADD CONSTRAINT oracle_decks_form_check CHECK (form IN ('cards', 'stones', 'staves', 'charms'));
-- A pull keeps the form the set had at the time, as it keeps the deck's name, so past pulls read the same after a change.
ALTER TABLE oracle_pulls ADD COLUMN IF NOT EXISTS deck_form TEXT NOT NULL DEFAULT 'cards';
ALTER TABLE oracle_pulls DROP CONSTRAINT IF EXISTS oracle_pulls_deck_form_check;
ALTER TABLE oracle_pulls ADD CONSTRAINT oracle_pulls_deck_form_check CHECK (deck_form IN ('cards', 'stones', 'staves', 'charms'));
