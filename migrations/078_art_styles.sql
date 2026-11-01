-- The picture-maker's style notes (open item P1): a note a person saves for a whole set, and a list of their own named styles. A style note only
-- describes how a picture looks (for example "ink drawing, grey tones, no faces"); the person writes it, and it is sent to the image tool with the
-- scene words they ticked. Private to the person and deleted with the account (the set's note goes with the set). Additive and safe to run twice.
-- The code works without it: until it is run, the picture-maker starts with an empty style note and saving one says it is not available yet.
ALTER TABLE oracle_decks ADD COLUMN IF NOT EXISTS art_style TEXT CHECK (art_style IS NULL OR char_length(art_style) <= 200);

CREATE TABLE IF NOT EXISTS art_styles (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  text       TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS art_styles_user ON art_styles(user_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS art_styles_name ON art_styles(user_id, LOWER(name));
