-- Prediction check-ins: what a person expects to happen after a reading of any tool, written down at the time and looked back on later.
-- `original_text` is sealed (the code never changes it); `text` may be reworded until an outcome is recorded. The outcome is the person's own
-- judgement: 'yes', 'partly', 'no', or 'unclear' (could not tell, or it never came up), which is left out of any count.
CREATE TABLE IF NOT EXISTS predictions (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  divination_id INTEGER NOT NULL REFERENCES divinations(id) ON DELETE CASCADE,
  original_text TEXT NOT NULL CHECK (char_length(original_text) <= 2000),
  text          TEXT NOT NULL CHECK (char_length(text) <= 2000),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- The day the person wants to look back on it; empty means no date.
  check_on      DATE,
  outcome       TEXT CHECK (outcome IN ('yes', 'partly', 'no', 'unclear')),
  outcome_note  TEXT CHECK (outcome_note IS NULL OR char_length(outcome_note) <= 2000),
  resolved_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS predictions_user ON predictions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS predictions_divination ON predictions(divination_id);
CREATE INDEX IF NOT EXISTS predictions_due ON predictions(user_id, check_on) WHERE outcome IS NULL AND check_on IS NOT NULL;
