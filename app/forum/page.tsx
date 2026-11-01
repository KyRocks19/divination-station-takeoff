import Link from "next/link";
import { query } from "@/lib/db";
import { getSession } from "@/lib/session";
import { parseDate, toISOString } from "@/lib/date";
import { CardLink } from "@/components/ui/Card";
import { PageTitle } from "@/components/ui/Page";
import { openReportCount, visibleSql } from "@/lib/forum-reports";
import { forumViewer } from "@/lib/forum-circles";
import { NO_CIRCLE_NOTE, canPost, listScope } from "@/lib/forum-circles-core";
import { SigilMark } from "@/components/ui/AppSigil";
import { shownAuthor } from "@/lib/forum-bundle-core";
import ForumMove from "@/components/forum/ForumMove";

export default async function ForumPage() {
  const session = await getSession();

  // A post reported by enough different people (HIDE_AFTER) is hidden from everyone but its author and the owner (migration 054).
  // The forum belongs to a circle (migration 074): a person reads the posts of their own circle and their own.
  const viewer = await forumViewer(session.userId ?? 0, !!session.isAdmin);
  const params: unknown[] = [session.userId ?? 0, !!session.isAdmin];
  const where = [visibleSql("fp", "$1", "$2"), listScope(viewer, "fp", params)];
  const posts = await query(`
    SELECT fp.*, u.username, u.display_name,
      (SELECT COUNT(*) FROM forum_post_attachments WHERE post_id = fp.id) AS attachment_count,
      (SELECT COUNT(*) FROM forum_comments WHERE post_id = fp.id AND hidden_at IS NULL) AS comment_count
    FROM forum_posts fp
    JOIN users u ON u.id = fp.user_id
    WHERE ${where.join(" AND ")}
    ORDER BY fp.created_at DESC
  `, params) as any[];
  const waiting = session.isAdmin || viewer.isLeader ? await openReportCount(session.isAdmin ? undefined : viewer.circleId ?? -1) : 0;
  const canWrite = canPost(viewer);

  return (
    <div className="max-w-page mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <PageTitle>Forum</PageTitle>
        {canWrite && (
          <Link
            href="/forum/new"
            className="bg-blush hover:bg-blush-soft text-canvas text-sm font-medium px-4 py-2 min-h-11 sm:min-h-0 rounded-lg transition-colors"
          >
            + New Post
          </Link>
        )}
      </div>

      {!canWrite && (
        <p className="text-sm text-ink-muted">
          {NO_CIRCLE_NOTE} <Link href="/circle" className="text-accent-ink hover:text-accent-ink-hover underline">Your circle</Link>
        </p>
      )}

      {waiting > 0 && (
        <p className="text-sm">
          <Link href="/forum/reports" className="text-warning-ink underline">{waiting} reported {waiting === 1 ? "item is" : "items are"} waiting for you</Link>
        </p>
      )}

      {posts.length === 0 ? (
        <div className="text-center py-20 text-ink-faint">
          <div aria-hidden="true" className="text-5xl mb-4 select-none"><SigilMark /></div>
          <p>No posts yet.</p>
          {canWrite && (
            <Link href="/forum/new" className="text-tone-400 hover:text-tone-300 text-sm mt-2 inline-block">
              Be the first to share a reading →
            </Link>
          )}
        </div>
      ) : (
        <ul className="space-y-3" aria-label={`${posts.length} post${posts.length !== 1 ? "s" : ""}`}>
          {posts.map((post) => {
            const date = parseDate(post.created_at);
            const preview = post.body.length > 150 ? post.body.slice(0, 150) + "…" : post.body;
            const authorName = shownAuthor(post);
            return (
              <li key={post.id}>
                <CardLink href={`/forum/${post.id}`} lift>
                  <div className="space-y-1.5">
                    <p className="font-medium text-ink-strong">{post.title}</p>
                    <p className="text-sm text-ink-faint line-clamp-2">{preview}</p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="text-xs text-tone-400">{authorName}</span>
                      {post.hidden_at && (
                        <span className="text-xs text-warning-ink border border-line rounded px-1.5 py-0.5">
                          {post.user_id === session.userId ? "Hidden from others while the owner looks at it" : "Hidden pending review"}
                        </span>
                      )}
                      <span className="text-xs text-ink-ghost">
                        <time dateTime={toISOString(post.created_at)}>{date.toLocaleDateString()}</time>
                      </span>
                      {Number(post.attachment_count) > 0 && (
                        <span className="text-xs bg-tone-900/30 text-tone-400 border border-line rounded px-1.5 py-0.5">
                          {post.attachment_count} attachment{Number(post.attachment_count) !== 1 ? "s" : ""}
                        </span>
                      )}
                      {Number(post.comment_count) > 0 && (
                        <span className="text-xs text-ink-ghost">
                          {post.comment_count} comment{Number(post.comment_count) !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </CardLink>
              </li>
            );
          })}
        </ul>
      )}

      {session.isAdmin && viewer.circleId !== null && <ForumMove />}
    </div>
  );
}

export const metadata = { title: "Forum" };
