import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Page, PageTitle } from "@/components/ui/Page";
import HostSetup from "@/components/HostSetup";
import { localDbDir } from "@/lib/local-db-core";
import { reachedOnThisComputer } from "@/lib/local-setup";
import { readHostNames } from "@/lib/host-names";
import { hostCircleMembers, isHostMode } from "@/lib/edition";
import { backupsFolder } from "@/lib/local-backup";

// The guided setup for a circle leader who serves their friends from this copy (open item H2.3, docs/plan-host-mode.md point 5). Only on a copy
// that keeps its data in a folder, only for its administrator, and only from this computer: the names it saves decide who can reach the copy.
export const metadata = { title: "Host a circle" };

export default async function HostPage() {
  if (!localDbDir()) notFound();
  const session = await getSession();
  if (!session.userId) redirect("/login?from=/host");
  const requestHeaders = await headers();
  const onThisComputer = reachedOnThisComputer(requestHeaders.get("host"), requestHeaders);
  const file = readHostNames();

  return (
    <Page>
      <PageTitle>Host a circle</PageTitle>
      {!session.isAdmin ? (
        <p className="text-sm text-ink-muted">Only the person who runs this copy can set up hosting.</p>
      ) : !onThisComputer ? (
        <p className="text-sm text-ink-muted">
          Hosting can only be set up on the computer this copy runs on. Open it there at http://localhost.
        </p>
      ) : (
        <HostSetup
          initial={{
            hostMode: isHostMode(),
            names: file.names,
            acknowledgedAt: file.acknowledgedAt,
            port: Number(process.env.PORT) || 47831,
            circleMax: hostCircleMembers(),
          }}
          backups={backupsFolder()}
        />
      )}
    </Page>
  );
}
