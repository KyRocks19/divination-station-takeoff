-- Letters (open item LP1): a person in a circle asks a question of one member or of the whole circle; a member reads for it with any tool,
-- seals a letter (their own words, and one line naming their reading if they chose one), and the asker opens it when ready. Later the asker
-- may write back how it went, and the reader sees the reply beside their reading. A blind letter keeps the question from the reader until
-- they have sealed their letter. Only the two people a letter is between ever see it; no one grades or scores anything.
-- older-versions: ok
CREATE TABLE IF NOT EXISTS letters (
  id              SERIAL PRIMARY KEY,
  -- The circle it was asked in. Picking up a letter needs the asker and the reader to be in this circle; after that it stays between the two.
  circle_id       INTEGER REFERENCES circles(id) ON DELETE SET NULL,
  asker_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- One member it was asked of, or null with to_circle = 1 for anyone in the circle.
  to_user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  to_circle       INTEGER NOT NULL DEFAULT 0,
  question        TEXT NOT NULL,
  -- 1 = the reader sees the question only after sealing their letter.
  blind           INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- The member it was asked of said they would rather not read for it.
  declined_at     TIMESTAMPTZ,
  -- Who is reading for it. A reader who deletes their account before sealing is taken off first (lib/auth.ts), so the question stays.
  reader_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
  taken_at        TIMESTAMPTZ,
  -- The reader's own reading, if they chose one. The line is a copy made when sealing, so it stays if the reading is deleted.
  divination_id   INTEGER REFERENCES divinations(id) ON DELETE SET NULL,
  reading_line    TEXT,
  letter          TEXT,
  sealed_at       TIMESTAMPTZ,
  opened_at       TIMESTAMPTZ,
  -- The day the asker would like a reminder to write back. Their own choice; empty means no reminder.
  write_back_on   DATE,
  reply           TEXT,
  replied_at      TIMESTAMPTZ,
  reply_seen_at   TIMESTAMPTZ,
  -- The reader took a sealed letter off their own list. The asker keeps the letter they were sent.
  reader_hidden_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS letters_asker ON letters(asker_id);
CREATE INDEX IF NOT EXISTS letters_reader ON letters(reader_id) WHERE reader_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS letters_to_user ON letters(to_user_id) WHERE to_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS letters_circle_open ON letters(circle_id) WHERE reader_id IS NULL;
CREATE INDEX IF NOT EXISTS letters_divination ON letters(divination_id) WHERE divination_id IS NOT NULL;
