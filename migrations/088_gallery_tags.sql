-- Tags on gallery pictures (open item P4, 2026-10-20). A few words the person puts on a picture so a big gallery can be sorted and found again.
-- The tags are the person's own words and live on the picture's row: they go with the picture when it is deleted and with the account. Additive;
-- the app works without this column (the gallery simply shows no tags until it is applied).
ALTER TABLE oracle_gallery ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
