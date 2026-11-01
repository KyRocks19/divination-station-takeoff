import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { reportQueue } from "@/lib/forum-reports";
import { circleSize, forumViewer } from "@/lib/forum-circles";
import { hideThreshold } from "@/lib/forum-circles-core";
import { Card } from "@/components/ui/Card";
import { BackLink, Page, PageTitle } from "@/components/ui/Page";
import ReportQueueActions from "@/components/ReportQueueActions";
import { parseDate } from "@/lib/date";

// The list of reported forum posts and comments: all of them for the owner of the app, one circle's for its leader.
export default async function ForumReportsPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  // The owner of the app sees every report; the leader of a circle sees the reports on their circle's posts.
  const viewer = await forumViewer(session.userId, !!session.isAdmin);
  if (!session.isAdmin && !(viewer.isLeader && viewer.circleId !== null)) redirect("/forum");

  const items = await reportQueue(session.isAdmin ? undefined : viewer.circleId!);
  const hideAt = viewer.circleId !== null ? hideThreshold(await circleSize(viewer.circleId)) : null;

  return (
    <Page>
      <BackLink href="/forum">← Forum</BackLink>
      <PageTitle>Reports</PageTitle>
      <p className="text-sm text-ink-faint">
        A post or comment reported by {hideAt ?? 5} different people is hidden from everyone but its author and you. &ldquo;Keep it up&rdquo; shows it again
        and closes its reports. &ldquo;Delete&rdquo; removes it.
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-ink-muted">Nothing is waiting.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((i) => (
            <li key={`${i.kind}-${i.id}`}>
              <Card className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="bg-tone-900/40 text-tone-400 border border-line rounded px-1.5 py-0.5">{i.kind === "post" ? "Post" : "Comment"}</span>
                  <span className="text-ink-faint">by {i.author}</span>
                  <span className="text-ink-faint">{i.reporters} {i.reporters === 1 ? "person" : "people"} reported it, first on {parseDate(i.first_reported).toLocaleDateString()}</span>
                  {i.hidden && <span className="text-warning-ink">Hidden from others</span>}
                </div>
                <p className="text-sm text-ink-soft whitespace-pre-wrap line-clamp-6">{i.text}</p>
                {i.reasons.length > 0 && (
                  <ul className="text-xs text-ink-faint list-disc pl-5 space-y-0.5">
                    {i.reasons.map((r, n) => <li key={n}>{r}</li>)}
                  </ul>
                )}
                <Link href={`/forum/${i.post_id}`} className="text-xs text-tone-400 underline">Open the post</Link>
                <ReportQueueActions kind={i.kind} id={i.id} />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}

export const metadata = { title: "Reported posts" };
