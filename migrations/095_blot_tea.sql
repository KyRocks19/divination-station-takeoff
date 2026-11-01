-- The tea a person chose before a tea-leaf reading (2026-10-25): one of TEA_KINDS in lib/tea-core.ts, or NULL for an ink blot, a cup saved
-- before teas could be chosen, or no choice. The leaves are drawn from the seed in that tea's shapes and colours.
ALTER TABLE blot_casts ADD COLUMN IF NOT EXISTS tea TEXT;
