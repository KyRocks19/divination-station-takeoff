-- Tarot readings join the shared record (`divinations`), so readings of every kind can be listed and compared
-- together. The tarot reading keeps all of its own data in `readings`; nothing in `readings` or `journals` changes.
-- The shared record points at the reading, so deleting a reading deletes its shared record too.

ALTER TABLE divinations ADD COLUMN IF NOT EXISTS reading_id INTEGER REFERENCES readings(id) ON DELETE CASCADE;

-- At most one shared record per tarot reading.
CREATE UNIQUE INDEX IF NOT EXISTS divinations_reading_id ON divinations(reading_id) WHERE reading_id IS NOT NULL;

-- One shared record for each existing tarot reading that belongs to someone and has none yet.
-- The summary lists the card names as they were stored, with "(reversed)" where a card was reversed.
INSERT INTO divinations (user_id, kind, title, question, summary, sky, created_at, reading_id)
SELECT r.user_id,
       'tarot',
       r.title,
       r.question,
       COALESCE((
         SELECT string_agg(c.card->>'card_name' || CASE WHEN c.card->>'reversed' IN ('true', '1') THEN ' (reversed)' ELSE '' END,
                           ', ' ORDER BY c.n)
         FROM jsonb_array_elements(r.cards::jsonb) WITH ORDINALITY AS c(card, n)
       ), ''),
       r.sky,
       r.created_at,
       r.id
FROM readings r
WHERE r.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM divinations d WHERE d.reading_id = r.id);
