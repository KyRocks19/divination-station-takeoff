import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { isLoginLimited } from "@/lib/login-limit";
import { passkeyLimitKeys, signInOptions, siteOf } from "@/lib/passkeys";

// Public on purpose (under /api/auth/login in proxy.ts PUBLIC_PATHS): the person is not signed in yet. Starts a passkey sign-in: the options
// for the browser, with a new challenge kept in the session cookie. No username is asked, so nothing here says which accounts exist.
export async function POST(request: NextRequest) {
  if (await isLoginLimited(passkeyLimitKeys(request.headers))) return Response.json({ error: "Too many tries. Try again later." }, { status: 429 });
  const options = await signInOptions(siteOf(request.nextUrl.href).rpID);
  const session = await getSession();
  session.pk = { c: options.challenge, for: "signin", at: Date.now() };
  await session.save();
  return Response.json(options);
}
