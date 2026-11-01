import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { verifyUserPassword } from "@/lib/auth";
import { clearLoginFailures, clientIp, isLoginLimited, loginKeys, recordLoginFailure } from "@/lib/login-limit";
import { addOptions, listPasskeys, siteOf } from "@/lib/passkeys";

/** The person's passkeys (names and dates only). */
export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ passkeys: await listPasskeys(session.userId) });
}

/**
 * Starts adding a passkey. The current password is asked first, so a browser left signed in cannot quietly gain a way back in; wrong
 * passwords count against the same limits as sign-in. Answers with the options for the browser, and keeps the challenge in the session.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId || !session.username) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const password = body?.password;
  if (typeof password !== "string" || !password) return Response.json({ error: "Your current password is needed to add a passkey." }, { status: 400 });

  const keys = loginKeys(clientIp(request.headers), session.username);
  if (await isLoginLimited(keys)) return Response.json({ error: "Too many tries. Try again later." }, { status: 429 });
  if (!(await verifyUserPassword(session.username, password))) {
    await recordLoginFailure(keys);
    return Response.json({ error: "That is not your current password." }, { status: 403 });
  }
  await clearLoginFailures(keys);

  const options = await addOptions(session.userId, session.username, siteOf(request.nextUrl.href).rpID);
  session.pk = { c: options.challenge, for: "add", at: Date.now() };
  await session.save();
  return Response.json(options);
}
