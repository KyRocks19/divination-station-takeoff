import { NextRequest } from "next/server";
import { queryOne, withTransaction } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { createRng } from "@/lib/rng";
import { skyAt } from "@/lib/sky";
import { insertDivination } from "@/lib/divinations";
import { cleanOptions, listTrials, loadTrial, pickTarget } from "@/lib/remoteview";

// The person's trials, newest first. A trial shows its options only after its impression is sealed and its target only after the choice (lib/remoteview.ts).
export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await listTrials(session.userId));
}

// Starts a trial. Body: { options: [four different targets], tz? }. The app picks the target by chance with the random method the person chose in
// Settings, keeps it sealed and does not return it or the options.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId;

  const body = await request.json().catch(() => null);
  const options = cleanOptions(body?.options);
  if (!options) return Response.json({ error: "Write four different targets, each 1 to 80 characters." }, { status: 400 });

  const [user, prefs] = await Promise.all([
    queryOne<{ rng_method: string | null }>("SELECT rng_method FROM users WHERE id = $1", [userId]),
    getPrefs(userId),
  ]);
  const rng = await createRng(user?.rng_method ?? "math");
  const target = pickTarget(rng);
  const sky = skyAt(new Date(), { tz: typeof body?.tz === "string" ? body.tz : null, hemisphere: prefs.hemisphere });

  const id = await withTransaction(async (client) => {
    const divinationId = await insertDivination(client, { userId, kind: "remoteview", question: null, summary: "Blind-target trial", sky: JSON.stringify(sky) });
    await client.query("INSERT INTO remoteview_trials (user_id, divination_id, options, target_index) VALUES ($1, $2, $3::jsonb, $4)", [userId, divinationId, JSON.stringify(options), target]);
    return divinationId;
  });

  return Response.json(await loadTrial(userId, id), { status: 201 });
}
