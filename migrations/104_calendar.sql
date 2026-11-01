-- The calendar of days (owner's request, 2026-10-30): how many times the person opened each of their readings, so a day on the calendar can show
-- the reading they went back to most, and their own changes to the Wheel of the Year festivals it shows (JSON, read by parseWheel in lib/calendar-core.ts).
-- older-versions: ok
ALTER TABLE divinations ADD COLUMN IF NOT EXISTS views INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wheel_calendar TEXT;
