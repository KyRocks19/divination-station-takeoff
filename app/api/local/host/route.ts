import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { logAdminAction } from "@/lib/admin-log";
import { localDbDir } from "@/lib/local-db-core";
import { reachedOnThisComputer } from "@/lib/local-setup";
import { changeHostNames } from "@/lib/host-names-core";
import { readHostNames, writeHostNames } from "@/lib/host-names";
import { hostCircleMembers, isHostMode } from "@/lib/edition";

// The /host page's data (open item H2.2): the names a leader's copy answers to besides this computer, and the leader's acknowledgement. Only the
// copy's administrator, and only from this computer (a loopback name): a friend who reaches the copy over Tailscale cannot read or change it, even
// as an admin. On a hosted copy it does not exist (404).

function refused(request: NextRequest, session: { userId?: number; isAdmin?: boolean }): Response | null {
  if (!localDbDir()) return Response.json({ error: "Not found" }, { status: 404 });
  if (!session.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (!reachedOnThisComputer(request.headers.get("host"), request.headers)) {
    return Response.json({ error: "Hosting can only be set up from the computer this copy runs on. Open it at http://localhost." }, { status: 403 });
  }
  return null;
}

function state() {
  const file = readHostNames();
  return {
    hostMode: isHostMode(),
    names: file.names,
    acknowledgedAt: file.acknowledgedAt,
    port: Number(process.env.PORT) || 47831,
    circleMax: hostCircleMembers(),
  };
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const no = refused(request, session);
  if (no) return no;
  return Response.json(state(), { headers: { "Cache-Control": "no-store" } });
}

/** PUT { add: "https://my-pc.tail1234.ts.net" } | { remove: "my-pc.tail1234.ts.net" } | { acknowledge: true } */
export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const no = refused(request, session);
  if (no) return no;
  const body = await request.json().catch(() => null);
  const before = readHostNames(0);
  const changed = changeHostNames(before, body);
  if (!changed.ok) return Response.json({ error: changed.error }, { status: 400 });
  writeHostNames(changed.file);
  for (const n of changed.file.names.filter((x) => !before.names.includes(x))) await logAdminAction(session, "host_name_added", { detail: n });
  for (const n of before.names.filter((x) => !changed.file.names.includes(x))) await logAdminAction(session, "host_name_removed", { detail: n });
  if (!before.acknowledgedAt && changed.file.acknowledgedAt) await logAdminAction(session, "host_acknowledged");
  return Response.json(state(), { headers: { "Cache-Control": "no-store" } });
}
