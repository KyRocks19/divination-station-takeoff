-- The header search ignores accents in the database too: "hekate" finds "Hékate" and the other way round (the unaccent
-- extension). The search checks for the extension itself (lib/search.ts) and falls back to plain case-insensitive matching
-- when it is missing, so nothing breaks before this runs. Adds an extension only; no table or column changes.
CREATE EXTENSION IF NOT EXISTS unaccent;
