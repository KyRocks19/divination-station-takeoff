-- Tags on readings of every tool (open item PAT1, 2026-10-18). Tarot readings have always had tags (reading_tags); the other tools' readings now can too.
-- The tag itself is the person's own (tags.user_id), the same list for every tool; this table only says which tag is on which reading. Both sides cascade,
-- so deleting a reading or a tag removes the link and nothing else.
CREATE TABLE IF NOT EXISTS divination_tags (
  divination_id INTEGER NOT NULL REFERENCES divinations(id) ON DELETE CASCADE,
  tag_id        INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (divination_id, tag_id)
);

CREATE INDEX IF NOT EXISTS divination_tags_tag ON divination_tags(tag_id);
