import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { verifyUserPassword } from "@/lib/auth";
import { clearLoginFailures, clientIp, isLoginLimited, loginKeys, recordLoginFailure } from "@/lib/login-limit";
import { familyUserAllowed } from "@/lib/family-access";
import { MAX_SCORE_NAME } from "@/lib/quick-exit-core";
import { lockAgainIf, openForSignIn } from "@/lib/unlock";

// The snake game's high-score name (docs/plan-feathered-edition.md 4.5). When this browser is locked by the quick exit and the name is the password of
// the account that locked it, the person is signed in again and told where to go back to. Any other name gets the same plain answer as a score, so the
// game never says that a name was a wrong password. Wrong names count like failed sign-ins (lib/login-limit.ts), and once there are too many they are not
// even checked, quietly. Names are never stored: a near-miss of a password must not be kept anywhere.
// Open to anyone, like the sign-in: the game is shown to people who are not signed in.
export async function POST(request: NextRequest) {
  const { name } = (await request.json().catch(() => null)) ?? {};
  const plain = Response.json({ ok: true });
  if (typeof name !== "string" || !name || name.length > MAX_SCORE_NAME) return plain;

  const session = await getSession();
  const decoy = session.decoy;
  if (!decoy) return plain;

  const keys = loginKeys(clientIp(request.headers), decoy.u);
  if (await isLoginLimited(keys)) return plain;

  // The quick exit locked the data too, on a sealed copy: the same password opens it.
  const opened = openForSignIn(name, "pass");
  if (opened === "wrong") {
    await recordLoginFailure(keys);
    return plain;
  }
  const user = await verifyUserPassword(decoy.u, name);
  if (!user || !(await familyUserAllowed(user.id))) {
    await lockAgainIf(opened);
    await recordLoginFailure(keys);
    return plain;
  }
  await clearLoginFailures(keys);

  session.userId = user.id;
  session.username = user.username;
  session.isAdmin = user.is_admin === 1;
  session.sv = user.session_version ?? 0;
  session.decoy = undefined;
  await session.save();
  return Response.json({ ok: true, to: decoy.back });
}
