import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { createUser } from "@/lib/auth";
import { joinProblem } from "@/lib/invites";
import { needsSetup, reachedOnThisComputer } from "@/lib/local-setup";
import { familyGateRequired } from "@/lib/family-access-core";
import { getLocalPool } from "@/lib/db";
import { createRecoveryCodes } from "@/lib/recovery";
import { FEATHERED } from "@/lib/edition";
import { computerDataDir, dataPlace, holdsData } from "@/lib/data-place";
import { keepOnThisComputer } from "@/lib/data-place-setup";

// Public on purpose (like /api/auth/join): it makes the ONE account of a copy that keeps its data in a folder on the computer, and only while there is no
// account yet and the request came by a name that means this computer (open item ED9). Once an account exists it refuses everyone.
// In the Feathered edition it also settles where the data is kept: locked with the password (`lock`, the first choice: one sealed file, with a set of
// recovery codes made now and shown once) or in an ordinary folder (lib/local-db.ts makeSealed and makeFolder; docs/plan-feathered-edition.md 4.2),
// and on the drive (the first choice) or in a folder on this computer (`place: "computer"`, lib/data-place.ts; 4.3).
let running = false;

export async function POST(request: NextRequest) {
  if (familyGateRequired()) return Response.json({ error: "First-run setup is only available in the local edition." }, { status: 404 });
  if (!reachedOnThisComputer(request.headers.get("host"), request.headers)) {
    return Response.json({ error: "Set-up can only be done from the computer this copy runs on. Open it at http://localhost." }, { status: 403 });
  }
  if (!(await needsSetup())) return Response.json({ error: "This copy is already set up. Sign in instead." }, { status: 409 });
  if (running) return Response.json({ error: "Set-up is already running. Wait a moment." }, { status: 409 });

  const body = await request.json().catch(() => ({}));
  const problem = joinProblem(body.username, body.password, body.displayName);
  if (problem) return Response.json({ error: problem }, { status: 400 });
  const username = (body.username as string).trim();
  const displayName = typeof body.displayName === "string" && body.displayName.trim() ? body.displayName.trim() : null;

  const onComputer = FEATHERED && body.place === "computer" && dataPlace() === "drive" && getLocalPool()?.mode() === "memory";
  if (onComputer && holdsData(computerDataDir())) {
    return Response.json({ error: `There is already Divination Station data on this computer, in ${computerDataDir()}. Keep this copy's data on the drive, or move that folder away first.` }, { status: 409 });
  }

  running = true;
  try {
    // Asked again now that this request holds the turn, so two requests cannot both make the account.
    if (!(await needsSetup())) return Response.json({ error: "This copy is already set up. Sign in instead." }, { status: 409 });
    // The one person on a local copy is its administrator: the pages that are only for administrators (editing the shared links, say) are theirs.
    const user = await createUser(username, displayName, body.password as string, true);
    let codes: string[] | undefined;
    const pool = onComputer ? await keepOnThisComputer() : getLocalPool();
    if (FEATHERED && pool && body.lock !== false) {
      codes = await createRecoveryCodes(user.id);
      await pool.makeSealed(body.password as string, codes, user.id);
    } else if (pool?.mode() === "memory") {
      await pool.makeFolder();
    }
    const session = await getSession();
    session.userId = user.id;
    session.username = user.username;
    session.isAdmin = true;
    session.sv = user.session_version ?? 0;
    await session.save();
    // The account has not read the privacy and terms text yet, so the page takes them to it.
    return Response.json({ ok: true, username: user.username, privacyNeeded: true, ...(codes ? { codes } : {}) }, { status: 201 });
  } finally {
    running = false;
  }
}
