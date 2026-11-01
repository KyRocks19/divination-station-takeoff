import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { addPasskey, cleanPasskeyName, freshChallenge, siteOf } from "@/lib/passkeys";

/** Finishes adding a passkey: checks the device's answer against the challenge in the session (used once) and keeps the passkey. */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const challenge = freshChallenge(session.pk, "add");
  delete session.pk;
  await session.save();
  if (!challenge) return Response.json({ error: "That took too long, or was already used. Start again." }, { status: 400 });

  const body = await request.json().catch(() => null);
  const name = cleanPasskeyName(body?.name) ?? "Passkey";
  if (!body?.response || typeof body.response !== "object") return Response.json({ error: "The device's answer is missing." }, { status: 400 });

  const result = await addPasskey(session.userId, body.response, challenge, siteOf(request.nextUrl.href), name);
  return result.ok ? Response.json({ ok: true, id: result.id }, { status: 201 }) : Response.json({ error: result.error }, { status: result.status });
}
