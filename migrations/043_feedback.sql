-- Notes from the people using the app to the person who runs it: something broken, an idea, something confusing. Each note
-- keeps the page it was sent from and (if the sender agreed) their device, so a problem can be found again. The owner can mark a
-- note seen or done and write a short reply that the sender can read. A person can delete their own notes.
CREATE TABLE IF NOT EXISTS feedback (
  id         BIGSERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('bug', 'idea', 'confusing', 'other')),
  message    TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 4000),
  page       TEXT CHECK (char_length(page) <= 300),
  device     TEXT CHECK (char_length(device) <= 300),
  status     TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'seen', 'done')),
  reply      TEXT CHECK (char_length(reply) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS feedback_user ON feedback(user_id, id DESC);
CREATE INDEX IF NOT EXISTS feedback_status ON feedback(status, id DESC);
