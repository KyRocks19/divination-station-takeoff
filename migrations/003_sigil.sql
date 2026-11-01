-- Migration 003: Add Signature Sigil to users
-- sigil_data stores a base64-encoded PNG data URL drawn by the user

ALTER TABLE users ADD COLUMN IF NOT EXISTS sigil_data TEXT;
