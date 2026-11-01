-- Layouts become the one place a person's positions live, tarot included.
--
-- 1. A position can have a colour of the person's choosing (optional; empty means the tool's own default).
-- 2. A position can have a place on a board (x, y in board units, and a turn in degrees), so a layout can be shown
--    as a picture like the Celtic Cross instead of a row. All three are empty for a plain list of positions.
-- 3. A tarot reading remembers which layout it used. The layout can be deleted later; the reading keeps its name
--    (readings.spread_name) and each card keeps its position name, colour, and place.
-- 4. users.starter_layouts says whether a person has been given their own copies of the app's four starting
--    spreads as ordinary layouts they can edit or delete (a script does the copying; see scripts/seed-starter-layouts.ts).
--
-- The old spreads table and readings.spread_id stay, untouched, as the record of past readings.

ALTER TABLE layout_positions ADD COLUMN IF NOT EXISTS color    TEXT CHECK (color IS NULL OR color ~ '^#[0-9a-fA-F]{6}$');
ALTER TABLE layout_positions ADD COLUMN IF NOT EXISTS x        INTEGER CHECK (x IS NULL OR (x >= 0 AND x <= 5000));
ALTER TABLE layout_positions ADD COLUMN IF NOT EXISTS y        INTEGER CHECK (y IS NULL OR (y >= 0 AND y <= 5000));
ALTER TABLE layout_positions ADD COLUMN IF NOT EXISTS rotation INTEGER CHECK (rotation IS NULL OR (rotation >= 0 AND rotation < 360));

ALTER TABLE readings ADD COLUMN IF NOT EXISTS layout_id INTEGER REFERENCES layouts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS readings_layout_id ON readings(layout_id);

ALTER TABLE users ADD COLUMN IF NOT EXISTS starter_layouts BOOLEAN NOT NULL DEFAULT FALSE;
