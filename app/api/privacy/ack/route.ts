import { getSession } from "@/lib/session";
import { acknowledgePrivacy } from "@/lib/privacy";

// Remembers that the signed-in person has read the current privacy and terms text.
export async function POST() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await acknowledgePrivacy(session.userId);
  return Response.json({ ok: true });
}
