-- What the person wants help with from the AI companion (slice 6g). All three are optional and can be changed or cleared at any time.
-- companion_focus: one key from a short fixed list (lib/companion-focus.ts); NULL means none chosen.
-- companion_focus_line: the person's own words about what they want; sent to the companion as their words, after the fixed safety lines.
-- companion_focus_asked: the highest reading-count milestone (10, 25, 50, ...) the invitation has been answered or set aside for.
ALTER TABLE users ADD COLUMN IF NOT EXISTS companion_focus TEXT CHECK (companion_focus IS NULL OR char_length(companion_focus) <= 40);
ALTER TABLE users ADD COLUMN IF NOT EXISTS companion_focus_line TEXT CHECK (companion_focus_line IS NULL OR char_length(companion_focus_line) <= 300);
ALTER TABLE users ADD COLUMN IF NOT EXISTS companion_focus_asked INTEGER NOT NULL DEFAULT 0;
