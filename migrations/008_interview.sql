-- Add 'interview' as a valid journal author for the Interview Me feature

ALTER TABLE journals DROP CONSTRAINT IF EXISTS journals_author_check;
ALTER TABLE journals ADD CONSTRAINT journals_author_check
  CHECK(author IN ('user', 'claude', 'hiero', 'guide', 'sword', 'interview'));
