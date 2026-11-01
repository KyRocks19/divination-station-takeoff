-- Cloths (open item T4, docs/plan-thrown-item-layouts.md, decided 2026-10-18). A cloth is a square the person throws items onto, with zones they
-- draw and name; an item belongs to the zone it landed in. This is apart from `layouts`, which deal one item to each numbered position: a cloth
-- has zones that items fall into. The app supplies no zones and no meanings. Everything is the person's own and is deleted with the account.
-- Places are whole numbers from 0 to 1000 across a square cloth (lib/cloth-core.ts). Additive and safe to run twice. The code works without it:
-- until it is run, the cloth screens say cloths are not set up yet.

CREATE TABLE IF NOT EXISTS cloths (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 600),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS cloths_user ON cloths(user_id);

-- A zone: a shape (the geometry is a small JSON object checked by the app: circle, ring, rectangle, half, wedge or freehand), the person's own name,
-- an optional note in their own words and an optional colour. Names differ within a cloth (ignoring capitals).
CREATE TABLE IF NOT EXISTS cloth_zones (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cloth_id   INTEGER NOT NULL REFERENCES cloths(id) ON DELETE CASCADE,
  name       TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  note       TEXT CHECK (note IS NULL OR char_length(note) <= 300),
  color      TEXT CHECK (color IS NULL OR color ~ '^#[0-9a-fA-F]{6}$'),
  geom       JSONB NOT NULL CHECK (jsonb_typeof(geom) = 'object'),
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS cloth_zones_cloth ON cloth_zones(cloth_id, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS cloth_zones_name ON cloth_zones(cloth_id, LOWER(name));

-- Where each item of a reading landed, as the person recorded it (or as the app threw it). It keeps the cloth's and the zone's names as they were
-- at the time, so the record reads the same if the cloth is changed or deleted later. One row for each item of a reading; all rows of a reading
-- are on the same cloth. `where_kind` is 'zone' (named by zone_name), 'none' (on the cloth, in no zone) or 'off' (off the cloth). `facing` is
-- 'up' or 'down' for the tools whose items have a face that can be hidden. `simulated` is true when the app threw the item.
CREATE TABLE IF NOT EXISTS cloth_placements (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  divination_id INTEGER NOT NULL REFERENCES divinations(id) ON DELETE CASCADE,
  item_index    INTEGER NOT NULL CHECK (item_index >= 0),
  item_label    TEXT NOT NULL,
  cloth_id      INTEGER REFERENCES cloths(id) ON DELETE SET NULL,
  cloth_name    TEXT NOT NULL,
  where_kind    TEXT NOT NULL CHECK (where_kind IN ('zone', 'none', 'off')),
  zone_name     TEXT,
  x             INTEGER,
  y             INTEGER,
  facing        TEXT CHECK (facing IS NULL OR facing IN ('up', 'down')),
  simulated     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (divination_id, item_index)
);
CREATE INDEX IF NOT EXISTS cloth_placements_user ON cloth_placements(user_id, cloth_id);
