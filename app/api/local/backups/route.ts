import { getSession } from "@/lib/session";
import { backupsAvailable, backupsFolder, listBackups, makeBackup } from "@/lib/local-backup";
import { logAdminAction } from "@/lib/admin-log";

// Backups of a copy that keeps its data in a folder on the computer (open item ED9). Only the copy's administrator (its one account) may list, make,
// download or restore them; on a hosted copy these routes do not exist (404).

export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (!backupsAvailable()) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ backups: listBackups(), folder: backupsFolder() });
}

export async function POST() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (!backupsAvailable()) return Response.json({ error: "Not found" }, { status: 404 });
  try {
    const made = await makeBackup("manual");
    await logAdminAction(session, "local_backup_made", { detail: made.name });
    return Response.json({ backup: made, backups: listBackups() }, { status: 201 });
  } catch (err) {
    console.warn(`[local-backup] could not make a backup: ${err instanceof Error ? err.message : err}`);
    return Response.json({ error: "The backup could not be made. Check that the disk has room, then try again." }, { status: 500 });
  }
}
