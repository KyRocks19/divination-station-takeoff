-- Art for a card, stone, stave, or charm of a personal set (slice 3). One picture per item, optional, replaceable,
-- removable. Two kinds: a drawing made in the app (kept as strokes in `strokes`, so it can be changed again) and an
-- uploaded picture (a JPEG, PNG, or WebP of at most 1 MB in `data`; the app refuses SVG files on purpose).
-- Kept in the database because the app runs where there is no writable disk. `alt` is the person's own description
-- for screen readers. Deleting the item deletes its picture.
CREATE TABLE IF NOT EXISTS oracle_card_art (
  card_id    INTEGER PRIMARY KEY REFERENCES oracle_cards(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('drawing', 'upload')),
  mime       TEXT,
  data       BYTEA,
  strokes    TEXT,
  alt        TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((kind = 'upload' AND data IS NOT NULL AND mime IS NOT NULL AND octet_length(data) <= 1000000)
      OR (kind = 'drawing' AND strokes IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS oracle_card_art_user_id ON oracle_card_art(user_id);
