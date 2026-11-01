import { NextRequest } from "next/server";
import { changeUserPassword } from "@/lib/auth";
import { removeAllPasskeys } from "@/lib/passkeys";
import { MIN_PASSWORD } from "@/lib/invites";
import { redeemRecoveryCode } from "@/lib/recovery";
import { recoveryCodeUsed } from "@/lib/seal";
import { lockAgainIf, openForSignIn } from "@/lib/unlock";
import { clearLoginFailures, clientIp, ipKey, isLoginLimited, recordLoginFailure } from "@/lib/login-limit";

// Sets a new password with a username and a recovery code. Public on purpose (proxy.ts PUBLIC_PATHS): the person cannot sign in.
// Wrong tries are limited per address and per username (the same counters as sign-in, under their own keys), and the answer for a
// wrong name, a wrong code and a used code is the same, so it does not say which accounts exist. Every sign-in of the account ends, and its passkeys are removed.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase().slice(0, 100) : "";
  const keys = { ip: ipKey("recover-ip", clientIp(request.headers)), user: `recover-user:${username}` };

  if (await isLoginLimited(keys)) return Response.json({ error: "Too many tries. Try again later." }, { status: 429 });

  const newPassword = body.newPassword;
  if (typeof newPassword !== "string" || newPassword.length < MIN_PASSWORD) {
    return Response.json({ error: `Choose a password of at least ${MIN_PASSWORD} characters.` }, { status: 400 });
  }
  if (newPassword.length > 200) return Response.json({ error: "That password is too long." }, { status: 400 });

  const wrong = () => Response.json({ error: "That username and code do not match, or the code was already used." }, { status: 403 });
  // A locked copy (lib/seal.ts): the code opens the data first, as the password would.
  const opened = typeof body.code === "string" ? openForSignIn(body.code, "code") : "wrong";
  if (opened === "wrong") {
    await recordLoginFailure(keys);
    return wrong();
  }

  let userId: number | null;
  try {
    userId = await redeemRecoveryCode(body.username, body.code);
  } catch (err) {
    await lockAgainIf(opened);
    throw err;
  }
  if (userId === null) {
    await lockAgainIf(opened);
    await recordLoginFailure(keys);
    return wrong();
  }

  // A used code stops opening the sealed data as well; the new password becomes its passphrase.
  recoveryCodeUsed(body.code);
  await changeUserPassword(userId, newPassword);
  // Whoever else had a way in loses it: passkeys are removed too, and the person can add theirs again.
  await removeAllPasskeys(userId);
  await clearLoginFailures(keys);
  return Response.json({ ok: true });
}
