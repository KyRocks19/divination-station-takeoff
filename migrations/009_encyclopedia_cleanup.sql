-- Merge duplicate/variant encyclopedia concepts into canonical forms.
-- For each pair: move card_concepts edges to the canonical concept, then delete the variant.
-- concept_notes are also re-parented so no user data is lost.

DO $$
DECLARE
  canonical_id  INTEGER;
  variant_id    INTEGER;
  pairs TEXT[][] := ARRAY[
    -- variant name,                                                       canonical name
    ARRAY['pregnancies',                                                   'pregnancy'],
    ARRAY['births',                                                        'birth'],
    ARRAY['marriages',                                                     'marriage'],
    ARRAY['weddings',                                                       'wedding'],
    ARRAY['profits',                                                       'profit'],
    ARRAY['achievements',                                                  'achievement'],
    ARRAY['reunions',                                                      'reunion'],
    ARRAY['cross roads',                                                   'crossroads'],
    ARRAY['fulfillment',                                                   'fulfilment'],
    ARRAY['open minded',                                                   'open-minded'],
    ARRAY['freethinking',                                                  'free-thinking'],
    ARRAY['finishing what you started',                                    'finishing what you start'],
    ARRAY['hard work will pay off',                                        'hard work paying off'],
    ARRAY['jump in',                                                       'jumping in'],
    ARRAY['rewards through hard work',                                     'rewards for hard work'],
    ARRAY['quick-wit',                                                     'quick-witted'],
    ARRAY['divorced',                                                      'divorce'],
    ARRAY['travelling',                                                    'travel'],
    ARRAY['use your head',                                                 'using your head'],
    ARRAY['making your wishes come true through persistence',              'making your dreams come true through persistence']
  ];
  pair TEXT[];
BEGIN
  FOREACH pair SLICE 1 IN ARRAY pairs LOOP
    SELECT id INTO variant_id   FROM concepts WHERE name = pair[1];
    SELECT id INTO canonical_id FROM concepts WHERE name = pair[2];

    -- Skip if either side doesn't exist in this DB
    IF variant_id IS NULL OR canonical_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Move card associations (ignore conflicts — edge may already exist on canonical)
    INSERT INTO card_concepts (card_id, concept_id)
      SELECT card_id, canonical_id FROM card_concepts WHERE concept_id = variant_id
      ON CONFLICT DO NOTHING;

    -- Re-parent user notes (skip if user already has a note on the canonical concept)
    UPDATE concept_notes SET concept_id = canonical_id
      WHERE concept_id = variant_id
        AND NOT EXISTS (
          SELECT 1 FROM concept_notes cn2
          WHERE cn2.concept_id = canonical_id AND cn2.user_id = concept_notes.user_id
        );

    -- Delete the variant (cascades card_concepts + any remaining notes)
    DELETE FROM concepts WHERE id = variant_id;

    RAISE NOTICE 'Merged "%" → "%"', pair[1], pair[2];
  END LOOP;
END;
$$;

-- Fix concepts with special characters that slipped through
-- (zero-width space after "motivation", curly-quote in "don't …")
UPDATE concepts
  SET name         = 'motivation',
      display_name = 'Motivation'
  WHERE name LIKE 'motivation%' AND name <> 'motivation';

UPDATE concepts
  SET name         = 'do not get drawn into arguments',
      display_name = 'Do not get drawn into arguments'
  WHERE name ILIKE '%don%t get drawn into arguments%'
    AND name <> 'do not get drawn into arguments';

-- Delete malformed concepts caused by orphaned [[ in source files.
-- The parser matched the bare [[ against the first ]] in the file, producing
-- concept names that contain table markup like "| | |---| |[[good news".
DELETE FROM concepts WHERE name LIKE '%|%[[%';

-- Normalise any remaining title-cased display names to sentence case.
-- (The source files are now all lowercase; this cleans up previously-seeded rows.)
UPDATE concepts
  SET display_name = initcap(name)
  WHERE display_name <> initcap(name)
    AND display_name = upper(left(display_name, 1)) || lower(right(display_name, -1));
