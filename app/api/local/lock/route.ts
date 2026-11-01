import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { getLocalPool, queryOne } from "@/lib/db";
import { verifyUserPassword } from "@/lib/auth";
import { createRecoveryCodes } from "@/lib/recovery";
import { isSealedCopy } from "@/lib/seal";
import { computerDataDir, currentDataDir, dataPlace, driveDataDir } from "@/lib/data-place";
import { clearLoginFailures, clientIp, isLoginLimited, loginKeys, recordLoginFailure } from "@/lib/login-limit";

// "Lock my data" in Settings (docs/plan-feathered-edition.md 4.2): turns the lock on a copy that keeps its data on this computer on or off. The
// password is asked again either way. Turning it on seals the data with that password and makes a new set of recovery codes, shown once, because
// they become the only way back if the password is forgotten. Only for a copy with one account: the lock opens with one person's password.
// Only the copy's administrator; a hosted copy has no such thing (404).

async function accounts(): Promise<number> {
  return (await queryOne<{ n: number }>("SELECT COUNT(*)::int AS n FROM users"))?.n ?? 0;
}

export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (!getLocalPool()) return Response.json({ error: "Not found" }, { status: 404 });
  // Where the data is, for "Move my data" (lib/data-place.ts); null on a copy not started from a portable folder.
  const place = dataPlace();
  const where = place && { place, folder: currentDataDir(), other: place === "drive" ? computerDataDir() : driveDataDir() };
  return Response.json({ locked: isSealedCopy(), canLock: (await accounts()) === 1, where });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });
  const pool = getLocalPool();
  if (!pool) return Response.json({ error: "Not found" }, { status: 404 });
  const { lock, password } = (await request.json().catch(() => null)) ?? {};
  if (typeof lock !== "boolean" || typeof password !== "string" || !password) {
    return Response.json({ error: "Type your password." }, { status: 400 });
  }

  const keys = loginKeys(clientIp(request.headers), session.username ?? "");
  if (await isLoginLimited(keys)) return Response.json({ error: "Too many tries. Try again later." }, { status: 429 });
  const user = await verifyUserPassword(session.username ?? "", password);
  if (!user || user.id !== session.userId) {
    await recordLoginFailure(keys);
    return Response.json({ error: "That is not your password." }, { status: 403 });
  }
  await clearLoginFailures(keys);

  try {
    if (lock) {
      if (isSealedCopy()) return Response.json({ locked: true });
      if ((await accounts()) !== 1) {
        return Response.json({ error: "Locking needs a copy with one account: the lock opens with one person's password." }, { status: 409 });
      }
      const codes = await createRecoveryCodes(user.id);
      await pool.makeSealed(password, codes, user.id);
      return Response.json({ locked: true, codes });
    }
    if (!isSealedCopy()) return Response.json({ locked: false });
    await pool.makeFolder();
    return Response.json({ locked: false });
  } catch (err) {
    console.warn(`[local-lock] could not change the lock: ${err instanceof Error ? err.message : err}`);
    return Response.json({ error: "That could not be done. Check that the drive has room, then try again." }, { status: 500 });
  }
}
