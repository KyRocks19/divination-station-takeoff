-- Passkeys (S10, owner decision 2026-10-22): another way to sign in, beside the password. Only the public half of each passkey is kept, with the
-- name the person gave it; the fingerprint, face or PIN that unlocks it never leaves their device. A passkey goes with the account.
CREATE TABLE IF NOT EXISTS passkeys (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- The credential's id and public key as the browser gives them (base64url).
  credential_id TEXT NOT NULL UNIQUE,
  public_key    TEXT NOT NULL,
  -- The authenticator's signature counter (0 for most passkeys, which do not count).
  counter       BIGINT NOT NULL DEFAULT 0,
  -- How the browser can reach it ("internal", "hybrid", "usb", ...), comma-separated.
  transports    TEXT,
  -- The site name it was made for (the host name without the port); it only works there.
  rp_id         TEXT NOT NULL,
  name          TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS passkeys_user_id ON passkeys(user_id);
