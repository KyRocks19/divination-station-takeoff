-- Backfill card_draws for readings saved without them (made through the Claude tool, or imported), so they
-- count in Patterns. Only touches readings that have no card_draws rows at all, so re-running adds nothing.

WITH missing AS (
  SELECT r.id, r.user_id, r.spread_name, r.created_at, r.cards::jsonb AS cards,
         CASE WHEN r.clarifiers LIKE '{%' THEN r.clarifiers::jsonb ELSE '{}'::jsonb END AS clarifiers
  FROM readings r
  WHERE r.user_id IS NOT NULL
    AND r.cards LIKE '[%'
    AND NOT EXISTS (SELECT 1 FROM card_draws d WHERE d.reading_id = r.id)
)
INSERT INTO card_draws
  (user_id, reading_id, card_id, card_name, position_name, spread_name,
   reversed, is_clarifier, clarifies_card_id, clarifies_position, created_at)
SELECT m.user_id, m.id, c->>'card_id', COALESCE(c->>'card_name', c->>'card_id'), COALESCE(c->>'position', ''),
       m.spread_name, CASE WHEN c->>'reversed' IN ('true', '1') THEN 1 ELSE 0 END, 0, NULL, NULL, m.created_at
FROM missing m
CROSS JOIN LATERAL jsonb_array_elements(m.cards) AS c
WHERE COALESCE(c->>'card_id', '') <> ''
UNION ALL
SELECT m.user_id, m.id, cl->>'card_id', COALESCE(cl->>'card_name', cl->>'card_id'), COALESCE(cl->>'position', 'Clarifier'),
       m.spread_name, CASE WHEN cl->>'reversed' IN ('true', '1') THEN 1 ELSE 0 END, 1,
       (m.cards -> (g.key)::int) ->> 'card_id', (m.cards -> (g.key)::int) ->> 'position', m.created_at
FROM missing m
CROSS JOIN LATERAL jsonb_each(m.clarifiers) AS g
CROSS JOIN LATERAL jsonb_array_elements(g.value) AS cl
WHERE g.key ~ '^[0-9]+$'
  AND jsonb_typeof(g.value) = 'array'
  AND COALESCE(cl->>'card_id', '') <> '';
