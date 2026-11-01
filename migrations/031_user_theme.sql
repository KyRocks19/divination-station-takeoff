-- A person's own colours for the app: a JSON object of token names to six-digit hex colours, for example
-- {"color-blush":"#fdccf5"}. NULL means the app's own colours, which is what every account has until it chooses.
ALTER TABLE users ADD COLUMN IF NOT EXISTS theme TEXT;
