import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { getLocalPool } from "@/lib/db";
import { reachedOnThisComputer } from "@/lib/local-setup";
import { safeBackPath } from "@/lib/quick-exit-core";
import { lockCopy } from "@/lib/unlock";

// The quick exit (docs/plan-feathered-edition.md 4.5): signs the person out at once and locks this browser on the snake game, remembering whose
// password unlocks it and which page to return to. Sent with keepalive as the page is replaced, so it may finish after the person has left.
// Open to anyone, like the sign-out: without a signed-in session it simply signs nothing out and locks nothing.
//
// With `stop: true` (a quick-exit way the person set to stop, components/QuickExitTriggers.tsx) it then also stops the app, as "Stop and remove the
// drive" does (app/api/local/stop/route.ts), under the same rules: the administrator of a copy on this computer, reached from this computer. Anyone
// else gets the lock alone. The server waits a little before it goes, so the game the tab is turning into has time to load.
const STOP_AFTER_MS = 1500;

export async function POST(request: NextRequest) {
  const { back, stop } = (await request.json().catch(() => null)) ?? {};
  const session = await getSession();
  if (!session.userId) return Response.json({ ok: true });
  const username = session.username;
  const mayStop = stop === true && session.isAdmin === true && reachedOnThisComputer(request.headers.get("host"), request.headers);
  session.userId = undefined;
  session.username = undefined;
  session.isAdmin = undefined;
  session.sv = undefined;
  session.pk = undefined;
  if (username) session.decoy = { u: username, back: safeBackPath(back) };
  await session.save();
  // A copy whose data is locked (lib/seal.ts) is saved and closed too: the server keeps running, and nothing opens without the password.
  await lockCopy();
  const pool = mayStop ? getLocalPool() : null;
  if (!pool) return Response.json({ ok: true });
  try {
    await pool.end();
  } catch (err) {
    // The lock above still stands; the app keeps running rather than stop with changes unsaved.
    console.warn(`[quick-exit] could not save before stopping: ${err instanceof Error ? err.message : err}`);
    return Response.json({ ok: true, stopped: false });
  }
  console.info("[quick-exit] stopped by a quick-exit way; the data is saved");
  setTimeout(() => process.exit(0), STOP_AFTER_MS);
  return Response.json({ ok: true, stopped: true });
}
