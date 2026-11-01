import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { getLocalPool } from "@/lib/db";
import { reachedOnThisComputer } from "@/lib/local-setup";
import { computerDataDir, currentDataDir, dataPlace, driveDataDir, holdsData, moveData, writeWhere } from "@/lib/data-place";

// "Move my data" in Settings (docs/plan-feathered-edition.md 4.3): moves a portable copy's data from the drive to a folder on this computer, or back.
// The data is saved and closed, every file is copied and checked before the old ones are removed, the note on the drive is changed, and the app stops:
// the person starts it again from its folder, and it opens the data where it is now. Only the copy's administrator, only from this computer;
// a copy that was not started from a portable folder has nothing to move (404).
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });
  const pool = getLocalPool();
  const place = dataPlace();
  const from = currentDataDir();
  const drive = driveDataDir();
  if (!pool || !place || !from || !drive) return Response.json({ error: "Not found" }, { status: 404 });
  if (!reachedOnThisComputer(request.headers.get("host"), request.headers)) {
    return Response.json({ error: "The data can only be moved from the computer the app runs on." }, { status: 403 });
  }
  const { to } = (await request.json().catch(() => null)) ?? {};
  if (to !== "drive" && to !== "computer") return Response.json({ error: "Say where to move it: the drive or this computer." }, { status: 400 });
  if (to === place) return Response.json({ error: "Your data is already there." }, { status: 400 });
  const target = to === "drive" ? drive : computerDataDir();
  if (holdsData(target)) {
    return Response.json({ error: `There is already Divination Station data in ${target}. Move that folder away first, so nothing is overwritten.` }, { status: 409 });
  }

  try {
    await pool.end();
  } catch (err) {
    console.warn(`[local-move] could not save before moving: ${err instanceof Error ? err.message : err}`);
    return Response.json({ error: "Your latest changes could not be saved, so nothing was moved." }, { status: 500 });
  }
  let moved: number;
  try {
    moved = moveData(from, target);
  } catch (err) {
    console.warn(`[local-move] could not move the data: ${err instanceof Error ? err.message : err}`);
    return Response.json({ error: "The data could not be copied there, so it stays where it was. Check there is room, then try again." }, { status: 500 });
  }
  writeWhere(to === "computer" ? target : null);
  console.info(`[local-move] moved ${moved} file(s) to ${target}; stopping so the next start opens them there`);
  setTimeout(() => process.exit(0), 300);
  return Response.json({ ok: true, folder: target });
}
