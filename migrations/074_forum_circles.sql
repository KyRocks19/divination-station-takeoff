-- The forum belongs to a circle (the user's decision of 2026-10-18, docs/plan-editions.md): a post is read only by the members of the circle it
-- was written in. Existing posts move to their author's circle now; an author with no circle keeps the post to themselves. If a circle is
-- deleted its posts stay with their authors (SET NULL), they are not deleted. Additive and safe to run twice.
ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS circle_id INTEGER REFERENCES circles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS forum_posts_circle ON forum_posts(circle_id, created_at DESC);

UPDATE forum_posts fp
   SET circle_id = cm.circle_id
  FROM circle_members cm
 WHERE cm.user_id = fp.user_id AND fp.circle_id IS NULL;
