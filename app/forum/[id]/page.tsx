import Link from "next/link";
import AddToDay from "@/components/AddToDay";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { query, queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";
import { parseDate, toISOString } from "@/lib/date";
import ForumCommentThread from "./CommentThread";
import ForumPostActions from "./PostActions";
import ForumSpreadView from "./SpreadView";
import { PageTitle } from "@/components/ui/Page";
import ReportButton from "@/components/ReportButton";
import { shownAuthor } from "@/lib/forum-bundle-core";
import { maskHidden, maySeeHidden } from "@/lib/forum-reports";
import { hydrateAttachment } from "@/lib/forum-attachments";
import { forumViewer } from "@/lib/forum-circles";
import { canModerate, canSeePost } from "@/lib/forum-circles-core";

const AUTHOR_COLORS: Record<string, string> = {
  user: "text-tone-400",
  claude: "text-tone-400",
  hiero: "text-tone-300",
  guide: "text-tone-400",
  sword: "text-warning-ink",
};

export default async function ForumPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  const post = await queryOne(`
    SELECT fp.*, u.username, u.display_name
    FROM forum_posts fp
    JOIN users u ON u.id = fp.user_id
    WHERE fp.id = $1
  `, [id]) as any;

  if (!post) notFound();

  // The forum belongs to a circle (migration 074): a post outside the person's circle is not there for them.
  const viewer = await forumViewer(session.userId ?? 0, !!session.isAdmin);
  if (!canSeePost(viewer, post)) notFound();
  const canRemove = canModerate(viewer, post);

  // Reported by enough different people (HIDE_AFTER): hidden from everyone but its author and the owner until the owner has looked (migration 054).
  const hiddenPost = !!post.hidden_at;
  if (hiddenPost && !maySeeHidden(post.user_id, session.userId ?? null, !!session.isAdmin)) {
    return (
      <div className="max-w-page mx-auto px-4 py-8 space-y-4">
        <Link href="/forum" className="text-sm text-tone-500 hover:text-tone-300 transition-colors">← Forum</Link>
        <p className="text-sm text-ink-muted">This post is hidden while the owner looks at it.</p>
      </div>
    );
  }

  const attRows = await query("SELECT * FROM forum_post_attachments WHERE post_id = $1 ORDER BY id ASC", [id]) as any[];
  const attachments = (await Promise.all(attRows.map(hydrateAttachment))).filter(Boolean) as any[];

  const comments = await query(`
    SELECT fc.*, u.username, u.display_name
    FROM forum_comments fc
    JOIN users u ON u.id = fc.user_id
    WHERE fc.post_id = $1
    ORDER BY fc.created_at ASC
  `, [id]) as any[];
  const shownComments = maskHidden(comments, session.userId ?? null, !!session.isAdmin);

  const authorName = shownAuthor(post);
  // Only the author edits; the owner and a circle leader can only remove (canRemove).
  const canEdit = session.userId === post.user_id;

  return (
    <div className="max-w-page mx-auto px-4 py-8 space-y-8">
      <Link href="/forum" className="text-sm text-tone-500 hover:text-tone-300 transition-colors">
        ← Forum
      </Link>

      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* No sigil here: a sigil is private to its owner (decided 2026-10-22). */}
          <span className="text-sm text-tone-400">{authorName}</span>
          <span className="text-xs text-ink-ghost">
            <time dateTime={toISOString(post.created_at)}>{parseDate(post.created_at).toLocaleDateString()}</time>
            {post.updated_at !== post.created_at && (
              <span className="ml-1 text-ink-ghost">(edited)</span>
            )}
          </span>
        </div>
        <PageTitle>{post.title}</PageTitle>
        {hiddenPost && (
          <p role="status" className="text-sm text-warning-ink border border-line rounded-control px-3 py-2">
            {session.isAdmin && session.userId !== post.user_id
              ? <>This post is hidden from others because it was reported. <Link href="/forum/reports" className="underline">Decide what to do</Link>.</>
              : "This post is hidden from others while the owner looks at it. Nothing is deleted, and you can still edit or delete it yourself."}
          </p>
        )}
        {session.userId && session.userId !== post.user_id && !hiddenPost && <ReportButton postId={post.id} what="post" />}
        {session.userId && !hiddenPost && <AddToDay kind="forum_post" refId={post.id} />}
      </div>

      <div className="prose prose-sm prose-invert prose-p:text-ink-soft prose-strong:text-tone-300 prose-em:text-tone-300 leading-relaxed">
        <ReactMarkdown>{post.body}</ReactMarkdown>
      </div>

      {attachments.length > 0 && (
        <section className="space-y-4" aria-label="Attachments">
          <h2 className="text-xs uppercase tracking-widest text-ink-faint">Attachments</h2>
          {attachments.map((att: any, i: number) => (
            <div key={i} className="bg-surface border border-line rounded-card p-4 space-y-3">
              {att.type === "reading" && (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs bg-tone-900/40 text-tone-400 border border-line rounded px-1.5 py-0.5">Reading</span>
                    <p className="text-xs text-tone-500 uppercase tracking-widest">{att.data.spread_name}</p>
                  </div>
                  {att.data.title && (
                    <p className="text-sm font-medium text-ink-strong">{att.data.title}</p>
                  )}
                  {att.data.question && (
                    <p className="text-xs text-ink-faint italic">&ldquo;{att.data.question}&rdquo;</p>
                  )}
                  <div className="overflow-x-auto">
                    <ForumSpreadView cards={att.data.cards} spreadName={att.data.spread_name} />
                  </div>
                  {att.data.clarifiers && Object.keys(att.data.clarifiers).length > 0 && (
                    <div className="space-y-2 pt-1">
                      <p className="text-xs uppercase tracking-widest text-ink-ghost">Clarifiers</p>
                      {Object.entries(att.data.clarifiers as Record<string, any[]>).map(([cardIdx, clarifierCards]) => {
                        const parentCard = att.data.cards[Number(cardIdx)];
                        return (
                          <div key={cardIdx} className="space-y-1">
                            <p className="text-xs text-ink-ghost">
                              Clarifying <span className="text-ink-muted">{parentCard?.card_name ?? `card ${cardIdx}`}</span>
                            </p>
                            <ul className="flex flex-wrap gap-1.5">
                              {clarifierCards.map((c: any, ci: number) => (
                                <li key={ci} className="text-xs bg-canvas border border-line-faint rounded px-2 py-1">
                                  <span className="text-ink-soft">{c.card_name}</span>
                                  {c.reversed && <span className="ml-1 text-danger-ink">(R)</span>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {att.type === "journal" && (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs bg-tone-900/40 text-tone-400 border border-line rounded px-1.5 py-0.5">Journal</span>
                    <span className={`text-xs font-medium ${AUTHOR_COLORS[att.data.author] ?? "text-ink-muted"}`}>
                      {att.data.author}
                    </span>
                    {att.data.reading && (
                      <span className="text-xs text-ink-ghost">from {att.data.reading.title || att.data.reading.spread_name}</span>
                    )}
                  </div>
                  <div className="prose prose-sm prose-invert prose-p:text-ink-soft leading-relaxed">
                    <ReactMarkdown>{att.data.content}</ReactMarkdown>
                  </div>
                </>
              )}

              {att.type === "synthesis_journal" && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-tone-900/40 text-tone-400 border border-line rounded px-1.5 py-0.5">Synthesis</span>
                  </div>
                  <p className="text-xs text-ink-faint italic">&ldquo;{(att.data as any).prompt}&rdquo;</p>
                  <div className="prose prose-sm prose-invert prose-p:text-ink-soft leading-relaxed">
                    <ReactMarkdown>{(att.data as any).content}</ReactMarkdown>
                  </div>
                </>
              )}
            </div>
          ))}
        </section>
      )}

      {(canEdit || canRemove) && (
        <ForumPostActions
          postId={post.id}
          canEdit={canEdit}
          canRemove={canRemove}
        />
      )}

      <section aria-label="Comments">
        <h2 className="text-xs uppercase tracking-widest text-ink-faint mb-4">
          Comments {shownComments.length > 0 ? `(${shownComments.length})` : ""}
        </h2>
        <ForumCommentThread
          postId={post.id}
          initialComments={shownComments}
          currentUserId={session.userId ?? null}
          isAdmin={canRemove}
        />
      </section>
    </div>
  );
}

export const metadata = { title: "Forum post" };
