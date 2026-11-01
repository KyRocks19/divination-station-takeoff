-- Pendulum: lines at tenths of a degree, more than one swing at the same angle, and an answer that remembers how its swing was chosen (chance, or the person's own movement).
-- The whole-degree column stays as it is; the tenth is a second column, so everything that reads whole degrees keeps working.
ALTER TABLE pendulum_swings  ADD COLUMN IF NOT EXISTS angle_tenths SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE pendulum_answers ADD COLUMN IF NOT EXISTS angle_tenths SMALLINT NOT NULL DEFAULT 0;
-- 'chance' (the app picked, with the person's random method) or 'motion' (the person's phone moved and the app matched it).
ALTER TABLE pendulum_answers ADD COLUMN IF NOT EXISTS chosen_by TEXT NOT NULL DEFAULT 'chance';
-- For 'motion': the shape of the movement and, for a line, its angle in whole degrees. Only this summary is kept, never the sensor readings.
ALTER TABLE pendulum_answers ADD COLUMN IF NOT EXISTS motion_shape TEXT;
ALTER TABLE pendulum_answers ADD COLUMN IF NOT EXISTS motion_angle SMALLINT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pendulum_swings_tenths') THEN
    ALTER TABLE pendulum_swings ADD CONSTRAINT pendulum_swings_tenths
      CHECK (angle_tenths BETWEEN 0 AND 9 AND (angle IS NOT NULL OR angle_tenths = 0));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pendulum_answers_tenths') THEN
    ALTER TABLE pendulum_answers ADD CONSTRAINT pendulum_answers_tenths
      CHECK (angle_tenths BETWEEN 0 AND 9 AND (angle IS NOT NULL OR angle_tenths = 0));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pendulum_answers_chosen_by') THEN
    ALTER TABLE pendulum_answers ADD CONSTRAINT pendulum_answers_chosen_by CHECK (chosen_by IN ('chance', 'motion'));
  END IF;
END $$;

-- A line's angle no longer has to be unique: a person can keep several swings at one angle, told apart by name.
-- The five starting swings stay one each, so they are never made twice.
DROP INDEX IF EXISTS pendulum_swings_line_angle;
CREATE UNIQUE INDEX IF NOT EXISTS pendulum_swings_builtin_line ON pendulum_swings(user_id, angle) WHERE shape = 'line' AND builtin = 1;
