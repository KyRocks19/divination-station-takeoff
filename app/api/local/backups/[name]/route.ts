import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { backupStream, backupsAvailable } from "@/lib/local-backup";

// Downloads one backup file by its name (a name that is not exactly one of the app's backup names finds nothing, so no other file can be reached).
export async function GET(_request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (!backupsAvailable()) return Response.json({ error: "Not found" }, { status: 404 });
  const { name } = await params;
  const file = backupStream(name);
  if (!file) return Response.json({ error: "Not found" }, { status: 404 });
  return new Response(file.stream, {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Length": String(file.bytes),
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
