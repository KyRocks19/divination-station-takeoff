-- The picture-maker's style note can now be 500 characters (MAX_STYLE_LENGTH in lib/art-maker.ts), up from 200. Migration 078 gave the two columns a
-- database-level limit of 200, so this replaces it. Additive in effect (no row changes, nothing removed from anyone's data) and safe to run twice.
-- The old limits are found by what they check rather than by name, so this works whatever Postgres called them.
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conrelid::regclass AS tbl, conname FROM pg_constraint
    WHERE contype = 'c' AND conrelid IN ('oracle_decks'::regclass, 'art_styles'::regclass)
      AND (pg_get_constraintdef(oid) LIKE '%char_length(art_style)%' OR pg_get_constraintdef(oid) LIKE '%char_length(text)%')
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', c.tbl, c.conname);
  END LOOP;
END $$;

ALTER TABLE oracle_decks ADD CONSTRAINT oracle_decks_art_style_len CHECK (art_style IS NULL OR char_length(art_style) <= 500);
ALTER TABLE art_styles ADD CONSTRAINT art_styles_text_len CHECK (char_length(text) BETWEEN 1 AND 500);
