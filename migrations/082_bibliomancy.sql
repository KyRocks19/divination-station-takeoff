-- Bibliomancy: words or phrases pulled at random from the person's own past writing. The reading is one shared record in `divinations` (kind
-- 'bibliomancy'); each pull is kept here as it was, with the sentence around it and a note of where it was found, because the writing it came from
-- can be changed or deleted later. Only words the person wrote themselves are ever pulled (never a line an AI wrote, never another person's writing).
CREATE TABLE IF NOT EXISTS bibliomancy_pulls (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  divination_id INTEGER NOT NULL REFERENCES divinations(id) ON DELETE CASCADE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  -- How much was pulled: a single word, a phrase (the stretch between marks like commas), or a sentence.
  unit          TEXT NOT NULL CHECK (unit IN ('word', 'phrase', 'sentence')),
  passage       TEXT NOT NULL,
  -- The sentence the passage was in (kept short), so it can be read in its place.
  context       TEXT,
  -- Which kind of writing it came from: 'journal', 'day', 'notes', 'prediction', 'meaning' or 'own'; and the row it came from, while that row exists.
  source_kind   TEXT NOT NULL,
  source_ref    TEXT,
  -- How the source was named then, for example "Journal on a Runes reading", and when it was written.
  source_label  TEXT NOT NULL,
  source_when   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS bibliomancy_pulls_divination_id ON bibliomancy_pulls(divination_id);
CREATE INDEX IF NOT EXISTS bibliomancy_pulls_user_passage  ON bibliomancy_pulls(user_id, lower(passage));
