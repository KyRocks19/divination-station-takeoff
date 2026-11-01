-- The I Ching: the record of one cast. The reading itself is one shared record in `divinations` (kind 'iching'); this table holds the six lines and the
-- two hexagrams they made, kept as they were at the time. The set of 64 hexagrams is fixed in code (lib/iching-data.ts). The person's own words for each
-- hexagram are kept in card_customizations and card_meaning_revisions under ids like 'hexagram-12'.
CREATE TABLE IF NOT EXISTS iching_casts (
  divination_id   INTEGER PRIMARY KEY REFERENCES divinations(id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- 'coins' and 'yarrow' were cast by the app; 'entered' is a cast the person made themselves and typed in.
  method          TEXT NOT NULL CHECK (method IN ('coins', 'yarrow', 'entered')),
  -- Six digits, bottom line first: 6 old yin, 7 young yang, 8 young yin, 9 old yang.
  lines           TEXT NOT NULL CHECK (lines ~ '^[6-9]{6}$'),
  primary_number  INTEGER NOT NULL CHECK (primary_number BETWEEN 1 AND 64),
  primary_name    TEXT NOT NULL,
  -- The hexagram the changing lines turn it into; empty when no line changes.
  relating_number INTEGER CHECK (relating_number BETWEEN 1 AND 64),
  relating_name   TEXT
);

CREATE INDEX IF NOT EXISTS iching_casts_user_primary  ON iching_casts(user_id, primary_number);
CREATE INDEX IF NOT EXISTS iching_casts_user_relating ON iching_casts(user_id, relating_number);
