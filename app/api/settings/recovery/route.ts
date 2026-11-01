import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { verifyUserPassword } from "@/lib/auth";
import { createRecoveryCodes, recoveryStatus } from "@/lib/recovery";
import { clearLoginFailures, clientIp, ipKey, isLoginLimited, recordLoginFailure } from "@/lib/login-limit";

// How many recovery codes are left.
export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await recoveryStatus(session.userId));
}

// Makes a new set of recovery codes (the old unused ones stop working). The password is asked again. The reply holds the readable
// codes; they cannot be shown again.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId || !session.username) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (typeof body.password !== "string" || !body.password) return Response.json({ error: "Type your password to make recovery codes." }, { status: 400 });

  const keys = { ip: ipKey("recovery-ip", clientIp(request.headers)), user: `recovery-user:${session.userId}` };
  if (await isLoginLimited(keys)) return Response.json({ error: "Too many tries. Try again later." }, { status: 429 });
  const user = await verifyUserPassword(session.username, body.password);
  if (!user || user.id !== session.userId) {
    await recordLoginFailure(keys);
    return Response.json({ error: "That password is not right." }, { status: 403 });
  }
  await clearLoginFailures(keys);

  return Response.json({ codes: await createRecoveryCodes(session.userId) }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
