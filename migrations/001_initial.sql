-- Crossroads of Tarot — initial PostgreSQL schema

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  display_name  TEXT,
  password_hash TEXT NOT NULL,
  is_admin      INTEGER NOT NULL DEFAULT 0,
  guide_name    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS spreads (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  positions   TEXT NOT NULL,
  is_preset   INTEGER NOT NULL DEFAULT 0,
  user_id     INTEGER REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS readings (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id),
  spread_id   INTEGER REFERENCES spreads(id) ON DELETE SET NULL,
  spread_name TEXT NOT NULL,
  title       TEXT,
  question    TEXT,
  cards       TEXT NOT NULL,
  clarifiers  TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journals (
  id              SERIAL PRIMARY KEY,
  reading_id      INTEGER NOT NULL REFERENCES readings(id) ON DELETE CASCADE,
  author          TEXT NOT NULL CHECK(author IN ('user', 'claude', 'hiero', 'guide', 'sword')),
  content         TEXT NOT NULL,
  card_index      INTEGER,
  clarifier_index INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS synthesis_journals (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prompt      TEXT NOT NULL,
  content     TEXT NOT NULL,
  context_ids TEXT NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS card_draws (
  id                 SERIAL PRIMARY KEY,
  user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reading_id         INTEGER REFERENCES readings(id) ON DELETE CASCADE,
  card_id            TEXT NOT NULL,
  card_name          TEXT NOT NULL,
  position_name      TEXT NOT NULL,
  spread_name        TEXT NOT NULL,
  reversed           INTEGER NOT NULL DEFAULT 0,
  is_clarifier       INTEGER NOT NULL DEFAULT 0,
  clarifies_card_id  TEXT,
  clarifies_position TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spread_color_overrides (
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  spread_id INTEGER NOT NULL REFERENCES spreads(id) ON DELETE CASCADE,
  colors    TEXT NOT NULL,
  PRIMARY KEY (user_id, spread_id)
);

CREATE TABLE IF NOT EXISTS forum_posts (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS forum_post_attachments (
  id       SERIAL PRIMARY KEY,
  post_id  INTEGER NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  type     TEXT NOT NULL CHECK(type IN ('reading', 'journal', 'synthesis_journal')),
  ref_id   INTEGER NOT NULL,
  snapshot TEXT
);

CREATE TABLE IF NOT EXISTS forum_comments (
  id         SERIAL PRIMARY KEY,
  post_id    INTEGER NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS forum_posts_created_at ON forum_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS forum_post_attachments_post_id ON forum_post_attachments(post_id);
CREATE INDEX IF NOT EXISTS forum_comments_post_id ON forum_comments(post_id);
