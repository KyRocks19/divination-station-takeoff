import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { getLocalPool } from "@/lib/db";
import { reachedOnThisComputer } from "@/lib/local-setup";

// "Stop and remove the drive" (docs/plan-feathered-edition.md 4.5): saves the data (sealed, on a locked copy), closes it and stops the app, so the
// drive can be taken out. The start file then empties the drive's temporary folder. Only the copy's administrator, and only from this computer;
// a hosted copy has no such thing (404).
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });
  const pool = getLocalPool();
  if (!pool) return Response.json({ error: "Not found" }, { status: 404 });
  if (!reachedOnThisComputer(request.headers.get("host"), request.headers)) {
    return Response.json({ error: "The app can only be stopped from the computer it runs on." }, { status: 403 });
  }
  try {
    await pool.end();
  } catch (err) {
    console.warn(`[local-stop] could not save before stopping: ${err instanceof Error ? err.message : err}`);
    return Response.json({ error: "Your latest changes could not be saved, so the app is still running. Check the drive is still in, then try again." }, { status: 500 });
  }
  console.info("[local-stop] stopped from the app's menu; the data is saved");
  // A moment for this answer to reach the browser before the server goes.
  setTimeout(() => process.exit(0), 300);
  return Response.json({ ok: true });
}
