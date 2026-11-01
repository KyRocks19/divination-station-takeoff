-- The one-time "Before you start" screen (pre-beta polish): which version of the privacy and terms text a person has read, and when.
-- 0 means not yet. Raising PRIVACY_VERSION in lib/privacy.ts asks everyone to read the new text once.
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_ack_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_ack_at TIMESTAMPTZ;
