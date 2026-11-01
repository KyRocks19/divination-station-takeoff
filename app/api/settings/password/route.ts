import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { changeUserPassword, verifyUserPassword } from "@/lib/auth";
import { jsonBody } from "@/lib/own-http";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const sent = await jsonBody(request);
  if (sent instanceof Response) return sent;
  const { currentPassword, newPassword } = sent;
  if (!currentPassword) {
    return Response.json({ error: "Current password is required" }, { status: 400 });
  }
  if (!newPassword || newPassword.length < 12) {
    return Response.json({ error: "Password must be at least 12 characters" }, { status: 400 });
  }
  const valid = await verifyUserPassword(session.username!, currentPassword);
  if (!valid) {
    return Response.json({ error: "Current password is incorrect" }, { status: 403 });
  }
  // Every other session of this account ends; this one is renewed so the person stays signed in here.
  const version = await changeUserPassword(session.userId, newPassword);
  if (version !== null) {
    session.sv = version;
    await session.save();
  }
  return Response.json({ ok: true });
}
