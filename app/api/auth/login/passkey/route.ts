import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { getUserById } from "@/lib/auth";
import { privacyAcknowledged } from "@/lib/privacy";
import { clearLoginFailures, isLoginLimited, recordLoginFailure } from "@/lib/login-limit";
import { familyUserAllowed } from "@/lib/family-access";
import { checkSignIn, freshChallenge, passkeyLimitKeys, siteOf } from "@/lib/passkeys";

// Public on purpose (under /api/auth/login in proxy.ts PUBLIC_PATHS). Finishes a passkey sign-in: the device's answer is checked against the
// challenge in the session (used once), and the account it names is signed in the same way as with a password. Every failure gets the same
// answer and counts against this address.
export async function POST(request: NextRequest) {
  const keys = passkeyLimitKeys(request.headers);
  if (await isLoginLimited(keys)) return Response.json({ error: "Too many tries. Try again later." }, { status: 429 });

  const session = await getSession();
  const challenge = freshChallenge(session.pk, "signin");
  delete session.pk;
  await session.save();
  const refused = async () => {
    await recordLoginFailure(keys);
    return Response.json({ error: "That passkey did not sign you in. Try again, or use your password." }, { status: 401 });
  };
  if (!challenge) return refused();

  const body = await request.json().catch(() => null);
  if (!body?.response || typeof body.response !== "object") return refused();
  const userId = await checkSignIn(body.response, challenge, siteOf(request.nextUrl.href));
  if (userId === null) return refused();
  const user = await getUserById(userId);
  if (!user || user.disabled === 1 || !(await familyUserAllowed(user.id))) return refused();
  await clearLoginFailures(keys);

  session.userId = user.id;
  session.username = user.username;
  session.isAdmin = user.is_admin === 1;
  session.sv = user.session_version ?? 0;
  await session.save();
  return Response.json({ ok: true, username: user.username, isAdmin: user.is_admin === 1, privacyNeeded: !(await privacyAcknowledged(user.id)) });
}
