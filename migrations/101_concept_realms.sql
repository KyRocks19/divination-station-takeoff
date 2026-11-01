-- Concepts get a realm of their own (X4a): a shared tarot concept's realm, set on the archetype review page, and a person's own
-- concept's realm, which they write themselves. NULL means the concept still takes the realm of its first archetype, as before.
-- older-versions: ok
ALTER TABLE concepts ADD COLUMN IF NOT EXISTS realm TEXT;
ALTER TABLE user_concepts ADD COLUMN IF NOT EXISTS realm TEXT;
