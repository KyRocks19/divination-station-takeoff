-- Owner decisions of 2026-10-22: guesses reach the companion only by a tick on that reading; how sure the person felt; a chosen look-back day
-- on any reading; tarot practice with a sealed card; and one "I am 18 or older" confirmation that unlocks sensitive concepts and the AI features.

-- On "write what you sense first" (migration 090): how sure the person felt when they sealed it (1 to 5, optional), and whether the companion
-- may read it for this one reading (off unless ticked).
ALTER TABLE reading_guesses ADD COLUMN IF NOT EXISTS confidence SMALLINT CHECK (confidence IS NULL OR confidence BETWEEN 1 AND 5);
ALTER TABLE reading_guesses ADD COLUMN IF NOT EXISTS companion_ok BOOLEAN NOT NULL DEFAULT FALSE;

-- The day the person asked to be reminded to look back on a reading (a week or a month on, or a day they chose). Null for none.
ALTER TABLE divinations ADD COLUMN IF NOT EXISTS look_back_on DATE;

-- Tarot practice: a card is drawn and sealed before the person guesses its suit (and, if they like, writes words); the card is shown after.
CREATE TABLE IF NOT EXISTS tarot_practice (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id     TEXT NOT NULL,
  guess_suit  TEXT CHECK (guess_suit IS NULL OR guess_suit IN ('major', 'wands', 'cups', 'swords', 'pentacles')),
  guess_words TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  guessed_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS tarot_practice_user ON tarot_practice(user_id, created_at);

-- "I am 18 or older", confirmed by the person in Settings. 0 until they do.
ALTER TABLE users ADD COLUMN IF NOT EXISTS adult_confirmed SMALLINT NOT NULL DEFAULT 0;
