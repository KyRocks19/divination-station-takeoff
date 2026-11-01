-- Picture-maker and gallery for oracle art. (1) users.art_help: whether the card page offers to make pictures with an image
-- tool on the person's own computer (on by default; the tool only runs when they press the button). (2) oracle_card_art.made_with:
-- a small note on how a picture was made ('local-image-tool'), which the person can remove. (3) oracle_gallery: pictures the person
-- keeps on the site that are not on any card; each is a JPEG, PNG, or WebP of at most 1 MB, private to its owner, and deleted
-- with the account.
ALTER TABLE users ADD COLUMN IF NOT EXISTS art_help INTEGER NOT NULL DEFAULT 1;
ALTER TABLE oracle_card_art ADD COLUMN IF NOT EXISTS made_with TEXT;

CREATE TABLE IF NOT EXISTS oracle_gallery (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mime       TEXT NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp')),
  data       BYTEA NOT NULL CHECK (octet_length(data) <= 1000000),
  alt        TEXT,
  prompt     TEXT,
  made_with  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS oracle_gallery_user_created ON oracle_gallery(user_id, created_at DESC);
