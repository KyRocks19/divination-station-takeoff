-- Gentle nudges on today's page (a prediction whose date has come, a reading to look back on) that the person dismissed.
-- A dismissed nudge stays gone on every device; the prediction or reading itself is untouched and still on its own page.
-- `target_id` is a prediction's id or a reading's shared record id (`divinations.id`), by `kind`; no foreign key, because
-- the two kinds live in different tables, and a row whose target is gone simply never matches again.
CREATE TABLE IF NOT EXISTS nudge_dismissals (
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('prediction', 'lookback')),
  target_id    INTEGER NOT NULL,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, kind, target_id)
);
