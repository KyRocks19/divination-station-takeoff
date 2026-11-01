-- Art can live as files on the disk of the computer that runs the app (ART_DIR) instead of inside the database, so Neon only
-- holds a small record per picture. `file_key` names the file ('<user id>/<uuid>.<png|jpg|webp|json>', checked here and in code);
-- when it is set, `data` (and a drawing's `strokes`) are empty. Rows made before this keep their bytes in the database until
-- scripts/move-art-to-disk.ts moves them. A picture whose file is not reachable (for example on a hosted copy of the app) is
-- shown as "stored on the owner's computer".
ALTER TABLE oracle_card_art ADD COLUMN IF NOT EXISTS file_key TEXT;
ALTER TABLE oracle_gallery ADD COLUMN IF NOT EXISTS file_key TEXT;

-- The old rule demanded the bytes (or strokes) in the row. Replace it with one that accepts either the bytes or a file.
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'oracle_card_art'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%octet_length%'
  LOOP
    EXECUTE format('ALTER TABLE oracle_card_art DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE oracle_card_art DROP CONSTRAINT IF EXISTS oracle_card_art_content;
ALTER TABLE oracle_card_art ADD CONSTRAINT oracle_card_art_content CHECK (
  (kind = 'upload' AND mime IS NOT NULL AND ((data IS NOT NULL AND octet_length(data) <= 1000000) OR file_key IS NOT NULL))
  OR (kind = 'drawing' AND (strokes IS NOT NULL OR file_key IS NOT NULL))
);
ALTER TABLE oracle_card_art DROP CONSTRAINT IF EXISTS oracle_card_art_file_key_shape;
ALTER TABLE oracle_card_art ADD CONSTRAINT oracle_card_art_file_key_shape CHECK (
  file_key IS NULL OR file_key ~ '^[0-9]+/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp|json)$'
);

ALTER TABLE oracle_gallery ALTER COLUMN data DROP NOT NULL;
ALTER TABLE oracle_gallery DROP CONSTRAINT IF EXISTS oracle_gallery_content;
ALTER TABLE oracle_gallery ADD CONSTRAINT oracle_gallery_content CHECK (data IS NOT NULL OR file_key IS NOT NULL);
ALTER TABLE oracle_gallery DROP CONSTRAINT IF EXISTS oracle_gallery_file_key_shape;
ALTER TABLE oracle_gallery ADD CONSTRAINT oracle_gallery_file_key_shape CHECK (
  file_key IS NULL OR file_key ~ '^[0-9]+/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$'
);
