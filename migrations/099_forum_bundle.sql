-- Moving a circle's forum between hosts (the owner's request of 2026-10-27). Each forum post and comment gets a stable id (a random text
-- id made once, never changed) so a file carried from one host to another can be brought in twice, or in both directions, without adding anything
-- twice. A post or comment brought in from another host whose author has no account here is kept under the person who brought it in, and
-- origin_author holds the name it was written under. Additive and safe to run twice.
ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS bundle_uid TEXT NOT NULL DEFAULT gen_random_uuid()::text;
ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS origin_author TEXT;
ALTER TABLE forum_comments ADD COLUMN IF NOT EXISTS bundle_uid TEXT NOT NULL DEFAULT gen_random_uuid()::text;
ALTER TABLE forum_comments ADD COLUMN IF NOT EXISTS origin_author TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS forum_posts_bundle_uid ON forum_posts(bundle_uid);
CREATE UNIQUE INDEX IF NOT EXISTS forum_comments_bundle_uid ON forum_comments(bundle_uid);
