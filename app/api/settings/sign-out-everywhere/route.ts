import { getSession } from "@/lib/session";
import { signOutEverywhere } from "@/lib/auth";

// Ends every sign-in of this account on every device, except this one, which is renewed so the person stays signed in here.
export async function POST() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const version = await signOutEverywhere(session.userId);
  if (version !== null) {
    session.sv = version;
    await session.save();
  }
  return Response.json({ ok: true });
}
