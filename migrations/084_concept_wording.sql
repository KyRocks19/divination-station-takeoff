-- Concept wording and Hiero descriptions (open item ED21, 2026-10-18).
-- concepts.sensitivity: 'reveal' = shown only to a person who turned on "Show sensitive meanings"; 'hidden' = shown to nobody (the card links stay).
-- concepts.aliases: the older wording of a reworded concept; search and import still find it by these, nothing shows them.
-- users.show_sensitive: the person's own choice, off for everyone until they turn it on.
-- concept_descriptions_user: the description Hiero wrote for one person on request; only that person reads it, and it goes with the account.
ALTER TABLE concepts ADD COLUMN IF NOT EXISTS sensitivity TEXT CHECK (sensitivity IN ('reveal', 'hidden'));
ALTER TABLE concepts ADD COLUMN IF NOT EXISTS aliases TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_sensitive BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS concept_descriptions_user (
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  concept_id   INTEGER NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  body         TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, concept_id)
);
