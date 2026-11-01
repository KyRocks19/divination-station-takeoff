import { NextRequest } from "next/server";
import { getSession, forgetAccountState } from "@/lib/session";
import { backupsAvailable, listBackups, restoreBackup } from "@/lib/local-backup";
import { logAdminAction } from "@/lib/admin-log";

// Replaces everything in this copy with one backup. The body must repeat the backup's name as `confirm`, so a stray request cannot do it. The data
// that was here is saved first as its own backup, named in the answer. One at a time.
let running = false;

export async function POST(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (!backupsAvailable()) return Response.json({ error: "Not found" }, { status: 404 });
  const { name } = await params;
  const body = await request.json().catch(() => ({}));
  if (body?.confirm !== name) return Response.json({ error: "The restore was not confirmed. Nothing was changed." }, { status: 400 });
  if (!listBackups().some((b) => b.name === name)) return Response.json({ error: "That backup is not here." }, { status: 404 });
  if (running) return Response.json({ error: "A restore is already running. Wait for it to finish." }, { status: 409 });
  running = true;
  try {
    const done = await restoreBackup(name);
    forgetAccountState(session.userId);
    // The account of this session may not exist in the restored data, and the person is signed in again either way.
    await logAdminAction(session, "local_backup_restored", { detail: name });
    session.destroy();
    return Response.json({ ok: true, ...done });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "The restore could not be done. Nothing was changed." }, { status: 500 });
  } finally {
    running = false;
  }
}
