-- The `release_cards` reference table (78 tarot cards with concept lists) was made by hand on the live database and no migration created it,
-- so a backup of live could not be restored into a fresh database. This describes it exactly as live has it; on live it does nothing.
CREATE TABLE IF NOT EXISTS release_cards (
  card_id TEXT PRIMARY KEY,
  card_name TEXT NOT NULL,
  arcana TEXT NOT NULL,
  number INTEGER,
  suit TEXT,
  element TEXT,
  upright_concepts TEXT[],
  reversed_concepts TEXT[],
  tower_effect TEXT,
  tower_effect_tag TEXT,
  wave_modifier TEXT,
  wave_modifier_tag TEXT,
  artina_upright TEXT,
  artina_reversed TEXT,
  gnosis_trigger BOOLEAN DEFAULT false,
  special_wave_event BOOLEAN DEFAULT false,
  generated_at TIMESTAMPTZ DEFAULT now()
);
