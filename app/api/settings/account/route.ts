import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { deleteUser, verifyUserPassword } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { deletionProblem } from "@/lib/account-deletion";
import { clearLoginFailures, clientIp, ipKey, isLoginLimited, recordLoginFailure } from "@/lib/login-limit";

// A person deletes their own account. The password is asked again and a phrase is typed, so a signed-in browser left open
// cannot be used to wipe someone's writing. Everything of theirs goes by the database's cascade (deleteUser); a circle they
// own passes to the member who joined first. There is no undo, which the screen says before it asks.
export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session.userId || !session.username) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));

  // Wrong passwords here count like wrong passwords at sign-in, and with their own keys so the two do not mix.
  const keys = { ip: ipKey("delete-ip", clientIp(request.headers)), user: `delete-user:${session.userId}` };
  if (await isLoginLimited(keys)) return Response.json({ error: "Too many tries. Try again later." }, { status: 429 });

  const others = await queryOne<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM users WHERE is_admin = 1 AND disabled = 0 AND id <> $1",
    [session.userId]
  );
  const problem = deletionProblem({
    phrase: body.confirm,
    password: body.password,
    isAdmin: !!session.isAdmin,
    otherActiveAdmins: others?.n ?? 0,
  });
  if (problem) return Response.json({ error: problem }, { status: 400 });

  const user = await verifyUserPassword(session.username, body.password as string);
  if (!user || user.id !== session.userId) {
    await recordLoginFailure(keys);
    return Response.json({ error: "That password is not right." }, { status: 403 });
  }
  await clearLoginFailures(keys);

  await deleteUser(session.userId);
  session.destroy();
  return Response.json({ ok: true });
}
