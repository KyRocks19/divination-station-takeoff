import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { BackLink, Page, PageTitle } from "@/components/ui/Page";
import { Card } from "@/components/ui/Card";
import { listAdminLog } from "@/lib/admin-log";
import { describeAdminAction } from "@/lib/admin-log-core";
import { toISOString } from "@/lib/date";

const PAGE_SIZE = 50;

// What administrators have done: resets, switch-offs, deletions, limits, invite codes, picture-computer tokens and decisions on
// reports. Only an admin sees it. It records who did what and when; it never holds a password, a code, a token or anyone's writing.
export default async function AdminLogPage({ searchParams }: { searchParams: Promise<{ before?: string }> }) {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  if (!session.isAdmin) redirect("/settings");

  const { before } = await searchParams;
  const beforeId = /^\d{1,9}$/.test(before ?? "") ? Number(before) : undefined;
  const rows = await listAdminLog(PAGE_SIZE + 1, beforeId);
  const shown = rows.slice(0, PAGE_SIZE);
  const more = rows.length > PAGE_SIZE ? shown[shown.length - 1].id : null;

  return (
    <Page>
      <BackLink href="/settings">← Settings</BackLink>
      <PageTitle>Admin log</PageTitle>
      <p className="text-sm text-ink-muted">
        What administrators have done, newest first. It records who, what and when. It never holds a password, a code, a token or anything
        anyone wrote.
      </p>
      {shown.length === 0 ? (
        <p className="text-sm text-ink-faint">{beforeId ? "Nothing older." : "Nothing has been logged yet."}</p>
      ) : (
        <ul className="space-y-2">
          {shown.map((r) => (
            <li key={r.id}>
              <Card pad="sm" className="text-sm">
                <p className="text-ink-strong">
                  <span className="font-medium">{r.admin_name}</span> {describeAdminAction(r)}
                </p>
                <p className="text-xs text-ink-faint mt-0.5">
                  <time dateTime={toISOString(r.created_at)}>{new Date(r.created_at).toLocaleString()}</time>
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {more !== null && (
        <Link href={`/admin/log?before=${more}`} className="inline-flex items-center min-h-11 sm:min-h-0 text-sm text-accent-ink hover:text-accent-ink-hover">
          Older entries
        </Link>
      )}
    </Page>
  );
}

export const metadata = { title: "Admin log" };
