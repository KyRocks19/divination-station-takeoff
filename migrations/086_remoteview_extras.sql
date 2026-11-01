-- Blind-target practice, second part: an ideogram drawn with the sealed impression, daily five-choice trials, and opt-in sharing of trial facts.

-- The ideogram (a quick drawing made before the thinking mind takes over): strokes as the drawing board keeps them, sealed with the impression.
ALTER TABLE remoteview_trials ADD COLUMN IF NOT EXISTS ideogram JSONB;

-- A daily trial: one of five symbols is the target, picked by chance and kept hidden. `seal_hash` is a SHA-256 of the target and a random `nonce`, shown to the
-- person at the start; the nonce is shown with the answer, so the person can check that the target was not changed after they chose. The target and the nonce
-- are never sent to the browser before the choice. Only one trial can be waiting at a time for a person.
CREATE TABLE IF NOT EXISTS remoteview_daily (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_index INTEGER NOT NULL CHECK (target_index BETWEEN 0 AND 4),
  nonce        TEXT NOT NULL,
  seal_hash    TEXT NOT NULL,
  choice_index INTEGER CHECK (choice_index BETWEEN 0 AND 4),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  judged_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS remoteview_daily_user_id ON remoteview_daily(user_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS remoteview_daily_one_waiting ON remoteview_daily(user_id) WHERE judged_at IS NULL;

-- Opt-in sharing of trial facts (off until the person turns it on, on a screen that lists exactly what is kept). `token` is a random code that stands in
-- for the person's name in the facts table. The link between the person and the code is kept here so the person can delete their facts at any time and so they
-- go when the account goes. It is pseudonymous, not anonymous.
CREATE TABLE IF NOT EXISTS remoteview_share (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per judged trial, and nothing else: which kind of trial, how many options, hit or miss, its place in the person's own sequence, and the week.
-- No writing, no drawing, no targets, no times of day, no account id.
CREATE TABLE IF NOT EXISTS remoteview_facts (
  id      SERIAL PRIMARY KEY,
  token   TEXT NOT NULL REFERENCES remoteview_share(token) ON DELETE CASCADE,
  tool    TEXT NOT NULL CHECK (tool IN ('blind4', 'daily5')),
  options INTEGER NOT NULL,
  hit     BOOLEAN NOT NULL,
  seq     INTEGER NOT NULL,
  week    DATE NOT NULL
);
CREATE INDEX IF NOT EXISTS remoteview_facts_token ON remoteview_facts(token);
