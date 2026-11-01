-- The first-run tour on the home page (pre-beta polish): when the person finished or skipped it. NULL means they have not seen it yet.
-- It never comes back by itself; "Replay the tour" on the How this works page shows it again without changing this.
ALTER TABLE users ADD COLUMN IF NOT EXISTS tour_seen_at TIMESTAMPTZ;
