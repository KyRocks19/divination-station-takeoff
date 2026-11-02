-- A tarot reading the person drew with their own deck and recorded here (owner's request, 2026-11-02). Its cards were already turned
-- over, so the reading opens at once: no opening wait and no "write what you sense first" step. I Ching and geomancy already know this
-- from their own `method = 'entered'`. Code that runs before this migration treats every reading as drawn by the app.
-- older-versions: ok
ALTER TABLE readings ADD COLUMN IF NOT EXISTS own_draw BOOLEAN NOT NULL DEFAULT FALSE;
