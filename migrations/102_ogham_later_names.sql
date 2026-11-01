-- Whether a person's ogham draws also show the later names that modern divination books give the five later letters (Koad, Oir,
-- Uilleand, Phagos, Mor). Off to start; the medieval names are shown either way. A person's own names for staves are kept in
-- symbol_own_names (migration 076), like the sides of a knucklebone.
-- older-versions: ok
ALTER TABLE users ADD COLUMN IF NOT EXISTS ogham_later_names INTEGER NOT NULL DEFAULT 0;
