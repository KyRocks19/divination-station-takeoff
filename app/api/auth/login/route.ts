import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { verifyUserPassword } from "@/lib/auth";
import { privacyAcknowledged } from "@/lib/privacy";
import { clearLoginFailures, clientIp, isLoginLimited, loginKeys, recordLoginFailure } from "@/lib/login-limit";
import { familyUserAllowed } from "@/lib/family-access";
import { lockAgainIf, openForSignIn } from "@/lib/unlock";

export async function POST(request: NextRequest) {
  // A body that is not JSON is answered like an empty form, not with a server error.
  const { username, password } = (await request.json().catch(() => null)) ?? {};

  if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
    return Response.json({ error: "Username and password are required" }, { status: 400 });
  }

  const keys = loginKeys(clientIp(request.headers), username);
  if (await isLoginLimited(keys)) {
    return Response.json({ error: "Too many login attempts. Try again later." }, { status: 429 });
  }

  // A locked copy (lib/seal.ts): the password opens the data first.
  const opened = openForSignIn(password, "pass");
  if (opened === "wrong") {
    await recordLoginFailure(keys);
    return Response.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const user = await verifyUserPassword(username.trim(), password);
  if (!user) {
    await lockAgainIf(opened);
    await recordLoginFailure(keys);
    return Response.json({ error: "Invalid username or password" }, { status: 401 });
  }

  if (!(await familyUserAllowed(user.id))) {
    await lockAgainIf(opened);
    await recordLoginFailure(keys);
    return Response.json({ error: "Invalid username or password" }, { status: 401 });
  }

  await clearLoginFailures(keys);

  const session = await getSession();
  session.userId = user.id;
  session.username = user.username;
  session.isAdmin = user.is_admin === 1;
  session.sv = user.session_version ?? 0;
  await session.save();

  // Someone who has not read the current privacy and terms text is taken to the one-time "Before you start" screen first.
  return Response.json({ ok: true, username: user.username, isAdmin: user.is_admin === 1, privacyNeeded: !(await privacyAcknowledged(user.id)) });
}
