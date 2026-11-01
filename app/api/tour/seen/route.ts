import { getSession } from "@/lib/session";
import { markTourSeen } from "@/lib/tour";

// Remembers that the signed-in person finished or skipped the first-run tour.
export async function POST() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await markTourSeen(session.userId);
  return Response.json({ ok: true });
}
