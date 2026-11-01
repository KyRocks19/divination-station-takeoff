import { queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";
import { createRng } from "@/lib/rng";
import { DAILY_OPTIONS } from "@/lib/remoteview-core";
import { dailyNumbers, recentDaily, waitingOrNew } from "@/lib/remoteview-daily";

// The person's daily trials with their results. A trial still waiting shows only its seal.
export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const [trials, numbers] = await Promise.all([recentDaily(session.userId), dailyNumbers(session.userId)]);
  return Response.json({ trials, numbers });
}

// Starts a daily trial, or returns the one already waiting. The target is picked by chance with the random method the person chose in Settings and is not
// returned: only the seal is.
export async function POST() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const user = await queryOne<{ rng_method: string | null }>("SELECT rng_method FROM users WHERE id = $1", [session.userId]);
  const rng = await createRng(user?.rng_method ?? "math");
  const target = Math.min(DAILY_OPTIONS - 1, Math.floor(rng() * DAILY_OPTIONS));
  return Response.json(await waitingOrNew(session.userId, target), { status: 201 });
}
