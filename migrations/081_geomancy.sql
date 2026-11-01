-- Geomancy: the record of one chart. The reading itself is one shared record in `divinations` (kind 'geomancy'). The sixteen figures of the set are fixed in
-- code (lib/geomancy-data.ts); the person's own words for each figure are kept in card_customizations and card_meaning_revisions under ids like
-- 'geomancy-via'. A chart is made from four Mothers; the rest of the chart follows from them by fixed rules, and every figure of it is kept as it was.
CREATE TABLE IF NOT EXISTS geomancy_charts (
  divination_id INTEGER PRIMARY KEY REFERENCES divinations(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- 'random' was cast by the app; 'entered' is four Mothers the person chose.
  method        TEXT NOT NULL CHECK (method IN ('random', 'entered')),
  -- Sixteen digits, 1 for a single dot and 2 for a double dot: four per Mother, the top line first, the First Mother first.
  mothers       TEXT NOT NULL CHECK (mothers ~ '^[12]{16}$')
);

CREATE TABLE IF NOT EXISTS geomancy_figures (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  divination_id INTEGER NOT NULL REFERENCES divinations(id) ON DELETE CASCADE,
  -- Where it sits in the chart: mother1 to mother4, daughter1 to 4, niece1 to 4, rightWitness, leftWitness, judge, reconciler.
  place         TEXT NOT NULL,
  -- The figure's id in the set, for example 'geomancy-via', and its Latin name as it was at the time.
  figure_id     TEXT NOT NULL,
  figure_name   TEXT NOT NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS geomancy_figures_divination_id ON geomancy_figures(divination_id);
CREATE INDEX IF NOT EXISTS geomancy_figures_user_figure   ON geomancy_figures(user_id, figure_id);
