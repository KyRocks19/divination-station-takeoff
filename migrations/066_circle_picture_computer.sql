-- Circles, build 3 (open item C3): a circle's own picture computer. A picture token can belong to a circle (made by the circle's owner on the Circle page),
-- and then it only takes pictures asked for by members of that circle who agreed to use it; the app's own studio (circle_id NULL) never takes those.
-- Each picture job remembers which circle's queue it is in. A circle's tokens never take companion requests (they carry people's own writing).

ALTER TABLE worker_tokens ADD COLUMN IF NOT EXISTS circle_id INTEGER REFERENCES circles(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS worker_tokens_circle ON worker_tokens(circle_id) WHERE circle_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'worker_tokens_circle_no_companion') THEN
    ALTER TABLE worker_tokens ADD CONSTRAINT worker_tokens_circle_no_companion CHECK (circle_id IS NULL OR can_companion = 0);
  END IF;
END $$;

-- A job asked for by a circle member goes to their circle's queue. Deleting the circle drops its waiting and finished pictures (they are kept
-- at most 24 hours anyway); the people's pictures saved on their own items are not here and are not touched.
ALTER TABLE image_jobs ADD COLUMN IF NOT EXISTS circle_id INTEGER REFERENCES circles(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS image_jobs_circle ON image_jobs(circle_id) WHERE circle_id IS NOT NULL;
