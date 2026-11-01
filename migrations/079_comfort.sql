-- Reading comfort kept in the account (open item T15a, decided 2026-10-18): the font, text size, spacing and motion choices of
-- lib/comfort.ts as one small JSON text, so they follow the person to every device they sign in on. Empty means "not saved in the
-- account": the choices on the device (the browser's local storage) apply, as before. Additive; the app works without it.
ALTER TABLE users ADD COLUMN IF NOT EXISTS comfort TEXT;
